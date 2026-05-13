import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class TaxDriveService {
  private readonly logger = new Logger(TaxDriveService.name);
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async createDrive(dto: any, actorId: string) {
    const r = await this.db.query(
      `INSERT INTO registry.tax_drive
         (drive_name, location, parish, area_id, drive_date, drive_end_date,
          lead_officer_id, status, target_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'PLANNED'),$9,$10,$11)
       RETURNING *`,
      [dto.driveName, dto.location, dto.parish, dto.areaId||null,
       dto.driveDate, dto.driveEndDate||null, dto.leadOfficerId||null,
       dto.status, dto.targetAmount||null, dto.notes||null, actorId],
    );
    return r[0];
  }

  async getDrives(filters: { parish?: string; status?: string; from?: string; to?: string }) {
    let q = `SELECT * FROM analytics.drive_summary WHERE 1=1`;
    const p: any[] = [];
    if (filters.parish) { p.push(filters.parish); q += ` AND parish = $${p.length}`; }
    if (filters.status) { p.push(filters.status); q += ` AND status = $${p.length}`; }
    if (filters.from)   { p.push(filters.from);   q += ` AND drive_date >= $${p.length}::date`; }
    if (filters.to)     { p.push(filters.to);      q += ` AND drive_date <= $${p.length}::date`; }
    return this.db.query(q + ' ORDER BY drive_date DESC', p);
  }

  async getDriveById(id: string) {
    const drives = await this.db.query(`SELECT * FROM analytics.drive_summary WHERE id = $1`, [id]);
    if (!drives[0]) throw new NotFoundException('Drive not found');
    const collections = await this.db.query(
      `SELECT tdc.*, u.full_name as collected_by_name
       FROM registry.tax_drive_collection tdc
       LEFT JOIN identity.user u ON u.id = tdc.collected_by
       WHERE tdc.drive_id = $1 ORDER BY tdc.created_at DESC`, [id],
    );
    return { ...drives[0], collections };
  }

  async updateDrive(id: string, dto: any) {
    await this.db.query(
      `UPDATE registry.tax_drive SET drive_name=$1, location=$2, parish=$3, area_id=$4,
       drive_date=$5, drive_end_date=$6, lead_officer_id=$7, status=$8,
       target_amount=$9, notes=$10, updated_at=NOW() WHERE id=$11`,
      [dto.driveName, dto.location, dto.parish, dto.areaId||null,
       dto.driveDate, dto.driveEndDate||null, dto.leadOfficerId||null,
       dto.status, dto.targetAmount||null, dto.notes||null, id],
    );
    return this.getDriveById(id);
  }

  async addCollection(driveId: string, dto: any, actorId: string) {
    const drive = await this.db.query(`SELECT id FROM registry.tax_drive WHERE id = $1`, [driveId]);
    if (!drive[0]) throw new NotFoundException('Drive not found');
    let caseId = dto.propertyCaseId || null;
    if (!caseId && dto.compositeKey) {
      const found = await this.db.query(
        `SELECT id FROM registry.property_case WHERE composite_key = $1`, [dto.compositeKey],
      );
      if (found[0]) caseId = found[0].id;
    }
    const r = await this.db.query(
      `INSERT INTO registry.tax_drive_collection
         (drive_id, property_case_id, composite_key, owner_name, property_address,
          parish, amount_collected, years_covered, payment_method, receipt_number, collected_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [driveId, caseId, dto.compositeKey||null, dto.ownerName, dto.propertyAddress||null,
       dto.parish||null, dto.amountCollected, dto.yearsCovered||null,
       dto.paymentMethod||'CASH', dto.receiptNumber||null, actorId, dto.notes||null],
    );
    if (caseId && dto.yearsCovered?.length > 0) {
      for (const year of dto.yearsCovered) {
        await this.db.query(
          `UPDATE registry.tax_balance SET amount_paid = LEAST(amount_due, amount_paid + $1)
           WHERE property_case_id = $2 AND tax_year = $3`,
          [dto.amountCollected / dto.yearsCovered.length, caseId, year],
        ).catch(() => {});
      }
    }
    return r[0];
  }

  async deleteCollection(collectionId: string) {
    await this.db.query(`DELETE FROM registry.tax_drive_collection WHERE id = $1`, [collectionId]);
    return { message: 'Deleted', collectionId };
  }

  async getDriveReport(period: string, from: string, to: string, parish?: string) {
    const trunc = period === 'quarterly' ? 'quarter' : period === 'yearly' ? 'year' : 'month';
    let q = `
      SELECT DATE_TRUNC('${trunc}', td.drive_date) as period,
             ${parish ? '' : 'td.parish,'}
             COUNT(DISTINCT td.id) as total_drives,
             COUNT(DISTINCT tdc.id) as total_transactions,
             COUNT(DISTINCT tdc.property_case_id) FILTER (WHERE tdc.property_case_id IS NOT NULL) as cases_settled,
             COALESCE(SUM(tdc.amount_collected),0) as total_collected,
             COALESCE(SUM(td.target_amount),0) as total_target,
             ROUND(COALESCE(SUM(tdc.amount_collected),0)/NULLIF(SUM(td.target_amount),0)*100,2) as achievement_pct
      FROM registry.tax_drive td
      LEFT JOIN registry.tax_drive_collection tdc ON tdc.drive_id = td.id
      WHERE td.drive_date BETWEEN $1::date AND $2::date AND td.status = 'COMPLETED'
    `;
    const p: any[] = [from, to];
    if (parish) { p.push(parish); q += ` AND td.parish = $${p.length}`; }
    q += ` GROUP BY 1${parish ? '' : ',2'} ORDER BY 1 DESC`;
    return this.db.query(q, p);
  }

  async getOverallDriveStats(from?: string, to?: string) {
    const f = from || '2020-01-01';
    const t = to || new Date().toISOString().split('T')[0];
    const r = await this.db.query(
      `SELECT COUNT(DISTINCT td.id) as total_drives,
              COUNT(DISTINCT td.id) FILTER (WHERE td.status='COMPLETED') as completed_drives,
              COUNT(DISTINCT td.id) FILTER (WHERE td.status='PLANNED') as planned_drives,
              COUNT(DISTINCT tdc.id) as total_transactions,
              COUNT(DISTINCT tdc.property_case_id) FILTER (WHERE tdc.property_case_id IS NOT NULL) as cases_settled,
              COALESCE(SUM(tdc.amount_collected),0) as total_collected,
              COALESCE(SUM(td.target_amount),0) as total_target,
              ROUND(AVG(sub.drive_total),2) as avg_per_drive
       FROM registry.tax_drive td
       LEFT JOIN registry.tax_drive_collection tdc ON tdc.drive_id = td.id
       LEFT JOIN (SELECT drive_id, SUM(amount_collected) as drive_total FROM registry.tax_drive_collection GROUP BY drive_id) sub ON sub.drive_id = td.id
       WHERE td.drive_date BETWEEN $1::date AND $2::date`,
      [f, t],
    );
    return r[0];
  }
}
