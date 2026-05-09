import {
  Injectable, NotFoundException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogDeliveryDto } from './dto/log-delivery.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async logDelivery(dto: LogDeliveryDto, officerId: string, deviceId?: string) {
    const caseResult = await this.db.query(
      `SELECT id, composite_key FROM registry.property_case
       WHERE id = $1 AND deleted_at IS NULL`,
      [dto.propertyCaseId],
    );
    const propertyCase = caseResult[0];
    if (!propertyCase) throw new NotFoundException(`Property case not found: ${dto.propertyCaseId}`);

    const result = await this.db.query(
      `INSERT INTO delivery.notice_delivery
        (property_case_id, officer_id, assignment_id, status, notes, recipient_name,
         gps_lat, gps_lng, gps_accuracy_m, delivered_at, local_id, sync_status,
         device_id, client_version)
       VALUES ($1, $2, $3, $4::delivery.delivery_status, $5, $6, $7, $8, $9,
               COALESCE($10::timestamptz, NOW()), $11, 'SYNCED', $12::uuid, $13)
       RETURNING id, status, delivered_at, gps_lat, gps_lng, created_at`,
      [
        dto.propertyCaseId,
        officerId,
        dto.assignmentId || null,
        dto.status,
        dto.notes || null,
        dto.recipientName || null,
        dto.gpsLat || null,
        dto.gpsLng || null,
        dto.gpsAccuracyM || null,
        dto.deliveredAt || null,
        dto.localId || null,
        deviceId || null,
        dto.clientVersion || null,
      ],
    );
    const delivery = result[0];

    await this.db.query(
      `UPDATE compliance.case_compliance_status
       SET last_delivery_status = $1,
           last_delivery_at = $2,
           updated_at = NOW()
       WHERE property_case_id = $3`,
      [dto.status, delivery.delivered_at, dto.propertyCaseId],
    );

    this.eventEmitter.emit('delivery.logged', {
      deliveryId: delivery.id,
      caseId: dto.propertyCaseId,
      compositeKey: propertyCase.composite_key,
      officerId,
      status: dto.status,
    });

    return {
      ...delivery,
      propertyCaseId: dto.propertyCaseId,
      compositeKey: propertyCase.composite_key,
    };
  }

  async batchSync(records: LogDeliveryDto[], officerId: string, deviceId: string) {
    const results = { synced: [] as any[], conflicts: [] as any[], failed: [] as any[] };

    for (const record of records) {
      try {
        if (record.localId) {
          const existing = await this.db.query(
            `SELECT id FROM delivery.notice_delivery WHERE local_id = $1::uuid`,
            [record.localId],
          );
          if (existing[0]) {
            results.synced.push({ localId: record.localId, serverId: existing[0].id, skipped: true });
            continue;
          }
        }
        const result = await this.logDelivery(record, officerId, deviceId);
        results.synced.push({ localId: record.localId, serverId: result.id });
      } catch (err) {
        if (err instanceof NotFoundException) {
          results.conflicts.push({ localId: record.localId, reason: err.message });
        } else {
          results.failed.push({ localId: record.localId, error: err.message });
        }
      }
    }
    return results;
  }

  async createAssignment(dto: CreateAssignmentDto, supervisorId: string) {
    const queryRunner = this.db.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await queryRunner.query(
        `INSERT INTO delivery.officer_assignment
          (officer_id, supervisor_id, area_id, assignment_date, total_cases, notes)
         VALUES ($1, $2, $3, $4::date, $5, $6)
         RETURNING id, assignment_date, status, total_cases`,
        [dto.officerId, supervisorId, dto.areaId, dto.assignmentDate, dto.caseIds.length, dto.notes || null],
      );
      const assignment = result[0];

      for (let i = 0; i < dto.caseIds.length; i++) {
        await queryRunner.query(
          `INSERT INTO delivery.assignment_case (assignment_id, property_case_id, sequence_order)
           VALUES ($1, $2, $3)`,
          [assignment.id, dto.caseIds[i], i + 1],
        );
      }

      await queryRunner.commitTransaction();
      return assignment;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getOfficerAssignments(officerId: string, date?: string) {
    const params: any[] = [officerId];
    let dateFilter = '';
    if (date) {
      params.push(date);
      dateFilter = `AND oa.assignment_date = $2::date`;
    }
    return this.db.query(
      `SELECT oa.id, oa.assignment_date, oa.status, oa.total_cases, oa.completed_cases,
              a.name as area_name, a.code as area_code, a.parish,
              sup.full_name as supervisor_name
       FROM delivery.officer_assignment oa
       JOIN gis.area a ON a.id = oa.area_id
       LEFT JOIN identity.user sup ON sup.id = oa.supervisor_id
       WHERE oa.officer_id = $1 ${dateFilter}
       ORDER BY oa.assignment_date DESC`,
      params,
    );
  }

  async getAssignmentCases(assignmentId: string, officerId: string) {
    const assignment = await this.db.query(
      `SELECT id FROM delivery.officer_assignment WHERE id = $1 AND officer_id = $2`,
      [assignmentId, officerId],
    );
    if (!assignment[0]) throw new NotFoundException('Assignment not found');

    return this.db.query(
      `SELECT pc.id as case_id, pc.composite_key, pc.valuation_number, pc.area_code,
              pc.owner_name_search as owner_name, pc.property_address, pc.property_type,
              ac.sequence_order,
              ccs.total_outstanding, ccs.years_outstanding
       FROM delivery.assignment_case ac
       JOIN registry.property_case pc ON pc.id = ac.property_case_id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE ac.assignment_id = $1
       ORDER BY ac.sequence_order ASC`,
      [assignmentId],
    );
  }

  async getAreaDeliverySummary(areaId: string, dateFrom: string, dateTo: string) {
    return this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE nd.status = 'DELIVERED')         as delivered,
         COUNT(*) FILTER (WHERE nd.status = 'OWNER_ABSENT')      as owner_absent,
         COUNT(*) FILTER (WHERE nd.status = 'REFUSED')           as refused,
         COUNT(*) FILTER (WHERE nd.status = 'VACANT')            as vacant,
         COUNT(*) FILTER (WHERE nd.status = 'INCORRECT_ADDRESS') as incorrect_address,
         COUNT(*) FILTER (WHERE nd.status = 'ACCESS_DENIED')     as access_denied,
         COUNT(*) FILTER (WHERE nd.status = 'DEMOLISHED')        as demolished,
         COUNT(*)                                                  as total,
         ROUND(COUNT(*) FILTER (WHERE nd.status = 'DELIVERED') * 100.0 / NULLIF(COUNT(*),0), 2) as delivery_rate_pct
       FROM delivery.notice_delivery nd
       JOIN delivery.officer_assignment oa ON oa.id = nd.assignment_id
       WHERE oa.area_id = $1
         AND nd.delivered_at BETWEEN $2::date AND $3::date + interval '1 day'`,
      [areaId, dateFrom, dateTo],
    );
  }

  async getAllAssignments(filters: { officerId?: string; status?: string }) {
    let query = `
      SELECT oa.id, oa.assignment_date, oa.status, oa.total_cases,
             oa.completed_cases, oa.notes,
             u.full_name as officer_name, u.id as officer_id,
             u.region as officer_region,
             a.name as area_name, a.parish, a.region,
             sup.full_name as assigned_by_name
      FROM delivery.officer_assignment oa
      JOIN identity.user u ON u.id = oa.officer_id
      JOIN gis.area a ON a.id = oa.area_id
      LEFT JOIN identity.user sup ON sup.id = oa.supervisor_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (filters.officerId) {
      params.push(filters.officerId);
      query += ` AND oa.officer_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      query += ` AND oa.status = $${params.length}`;
    }
    query += ` ORDER BY oa.assignment_date DESC LIMIT 100`;
    return this.db.query(query, params);
  }

  async updateAssignmentStatus(assignmentId: string, status: string) {
    await this.db.query(
      `UPDATE delivery.officer_assignment SET status = $1 WHERE id = $2`,
      [status, assignmentId],
    );
    return { message: 'Updated', assignmentId, status };
  }

  async removeAssignment(assignmentId: string) {
    await this.db.query(
      `DELETE FROM delivery.officer_assignment WHERE id = $1`,
      [assignmentId],
    );
    return { message: 'Removed', assignmentId };
  }

  async getOfficers() {
    return this.db.query(
      `SELECT u.id, u.full_name, u.email, u.region,
              u.employee_number, r.name as role_name
       FROM identity.user u
       JOIN identity.role r ON r.id = u.role_id
       WHERE u.is_active = true AND u.deleted_at IS NULL
       ORDER BY u.full_name ASC`,
    );
  }

  async createSimpleAssignment(
    dto: { officerId: string; areaId: string; assignmentDate: string; notes?: string },
    supervisorId: string,
  ) {
    const caseCount = await this.db.query(
      `SELECT COUNT(*) as count FROM registry.property_case
       WHERE area_id = $1 AND deleted_at IS NULL`,
      [dto.areaId],
    );
    const area = await this.db.query(
      `SELECT name, parish FROM gis.area WHERE id = $1`,
      [dto.areaId],
    );
    if (!area[0]) throw new Error('Area not found');
    const result = await this.db.query(
      `INSERT INTO delivery.officer_assignment
         (officer_id, supervisor_id, area_id, assignment_date, total_cases, status, notes)
       VALUES ($1, $2, $3, $4::date, $5, 'PENDING', $6)
       RETURNING id, assignment_date, status, total_cases`,
      [
        dto.officerId,
        supervisorId,
        dto.areaId,
        dto.assignmentDate,
        Number(caseCount[0].count),
        dto.notes || null,
      ],
    );
    return {
      ...result[0],
      area_name: area[0].name,
      parish: area[0].parish,
    };
  }
}
