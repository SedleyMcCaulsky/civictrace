import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateCaseDto } from './dto/create-case.dto';
import { SearchCasesDto } from './dto/search-cases.dto';

function normalizeForSearch(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

@Injectable()
export class PropertyCaseService {
  private readonly logger = new Logger(PropertyCaseService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createCase(dto: CreateCaseDto, actorId: string) {
    const areaResult = await this.db.query(
      `SELECT id, code, name FROM gis.area WHERE id = $1 AND is_active = true`,
      [dto.areaId],
    );
    const area = areaResult[0];
    if (!area) throw new NotFoundException(`Area not found: ${dto.areaId}`);

    const existing = await this.db.query(
      `SELECT id FROM registry.property_case
       WHERE area_id = $1 AND valuation_number = $2 AND deleted_at IS NULL`,
      [dto.areaId, dto.valuationNumber],
    );
    if (existing[0]) {
      throw new ConflictException(
        `Case already exists: ${area.code}::${dto.valuationNumber}`,
      );
    }

    const ownerNameSearch = normalizeForSearch(dto.ownerName);
    const compositeKey = `${area.code}::${dto.valuationNumber}`;

    const queryRunner = this.db.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const caseResult = await queryRunner.query(
        `INSERT INTO registry.property_case
          (area_id, area_code, valuation_number, composite_key, owner_name,
           owner_name_search, property_address, property_type, volume, folio, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, area_code, valuation_number, composite_key,
                   property_address, property_type, volume, folio, created_at`,
        [
          dto.areaId,
          area.code,
          dto.valuationNumber,
          compositeKey,
          dto.ownerName,
          ownerNameSearch,
          dto.propertyAddress,
          dto.propertyType,
          dto.volume || null,
          dto.folio || null,
          actorId,
        ],
      );
      const newCase = caseResult[0];

      for (const balance of dto.taxBalances) {
        await queryRunner.query(
          `INSERT INTO registry.tax_balance
            (property_case_id, tax_year, amount_due, status)
           VALUES ($1, $2, $3, 'OUTSTANDING')`,
          [newCase.id, balance.taxYear, balance.amountDue],
        );
      }

      const totalOutstanding = dto.taxBalances.reduce(
        (sum, b) => sum + b.amountDue, 0,
      );

      await queryRunner.query(
        `INSERT INTO compliance.case_compliance_status
          (property_case_id, status, risk_level, total_outstanding, years_outstanding)
         VALUES ($1, 'DELINQUENT', 'UNKNOWN', $2, $3)`,
        [newCase.id, totalOutstanding, dto.taxBalances.length],
      );

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('case.created', {
        caseId: newCase.id,
        compositeKey,
        actorId,
        areaId: dto.areaId,
      });

      this.logger.log(`Case created: ${compositeKey} by ${actorId}`);

      return {
        ...newCase,
        ownerName: dto.ownerName,
        taxBalances: dto.taxBalances,
        area: { id: area.id, code: area.code, name: area.name },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async searchCases(dto: SearchCasesDto, organisationId?: string) {
    const conditions: string[] = ['pc.deleted_at IS NULL'];
    if (organisationId) { conditions.push(`pc.organisation_id = '${organisationId}'`); }
    const params: any[] = [];
    let paramIndex = 1;

    if (dto.areaId) {
      conditions.push(`pc.area_id = $${paramIndex++}`);
      params.push(dto.areaId);
    }
    if (dto.areaCode) {
      conditions.push(`pc.area_code = $${paramIndex++}`);
      params.push(dto.areaCode.toUpperCase());
    }
    if (dto.valuationNumber) {
      conditions.push(`pc.valuation_number ILIKE $${paramIndex++}`);
      params.push(`%${dto.valuationNumber}%`);
    }
    if (dto.ownerName) {
      conditions.push(`pc.owner_name_search ILIKE $${paramIndex++}`);
      params.push(`%${normalizeForSearch(dto.ownerName)}%`);
    }
    if (dto.compositeKey) {
      conditions.push(`pc.composite_key = $${paramIndex++}`);
      params.push(dto.compositeKey);
    }

    const offset = ((dto.page || 1) - 1) * (dto.limit || 20);
    const whereClause = conditions.join(' AND ');

    const [cases, countResult] = await Promise.all([
      this.db.query(
        `SELECT pc.id, pc.area_code, pc.valuation_number, pc.composite_key,
                pc.owner_name_search as owner_name, pc.property_address,
                pc.property_type, pc.volume, pc.folio, pc.created_at,
                a.name as area_name, a.parish,
                ccs.status as compliance_status, ccs.risk_level,
                ccs.total_outstanding, ccs.years_outstanding
         FROM registry.property_case pc
         JOIN gis.area a ON a.id = pc.area_id
         LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
         WHERE ${whereClause}
         ORDER BY pc.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, dto.limit || 20, offset],
      ),
      this.db.query(
        `SELECT COUNT(*) as total FROM registry.property_case pc WHERE ${whereClause}`,
        params,
      ),
    ]);

    return {
      data: cases,
      pagination: {
        total: parseInt(countResult[0].total),
        page: dto.page || 1,
        limit: dto.limit || 20,
        totalPages: Math.ceil(parseInt(countResult[0].total) / (dto.limit || 20)),
      },
    };
  }

  async getCaseById(caseId: string) {
    const caseResult = await this.db.query(
      `SELECT pc.id, pc.area_id, pc.area_code, pc.valuation_number, pc.composite_key,
              pc.owner_name_search as owner_name, pc.property_address,
              pc.property_type, pc.volume, pc.folio, pc.created_at, pc.updated_at,
              a.name as area_name, a.parish,
              ccs.status as compliance_status, ccs.risk_level, ccs.risk_score,
              ccs.total_outstanding, ccs.years_outstanding,
              ccs.last_delivery_status, ccs.last_delivery_at, ccs.last_payment_at
       FROM registry.property_case pc
       JOIN gis.area a ON a.id = pc.area_id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE pc.id = $1 AND pc.deleted_at IS NULL`,
      [caseId],
    );
    const caseRecord = caseResult[0];
    if (!caseRecord) throw new NotFoundException(`Case not found: ${caseId}`);

    const balances = await this.db.query(
      `SELECT id, tax_year, amount_due, amount_paid, balance, status, last_reconciled_at
       FROM registry.tax_balance
       WHERE property_case_id = $1
       ORDER BY tax_year DESC`,
      [caseId],
    );

    const deliveries = await this.db.query(
      `SELECT nd.id, nd.status, nd.notes, nd.delivered_at,
              u.full_name as officer_name
       FROM delivery.notice_delivery nd
       JOIN identity.user u ON u.id = nd.officer_id
       WHERE nd.property_case_id = $1
       ORDER BY nd.delivered_at DESC
       LIMIT 5`,
      [caseId],
    );

    return {
      ...caseRecord,
      taxBalances: balances,
      recentDeliveries: deliveries,
    };
  }

  async getAreas() {
    return this.db.query(
      `SELECT id, code, name, parish, region
       FROM gis.area
       WHERE is_active = true
       ORDER BY parish, name ASC`,
    );
  }
}
