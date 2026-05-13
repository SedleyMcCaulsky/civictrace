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
         (drive_name, location, parish, area_id, drive_date,
          lead_officer_id, status, target_amount,
          amount_cash, amount_debit, amount_credit, amount_cheque,
          taxpayer_count, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'PLANNED'),$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [dto.driveName, dto.location, dto.parish, dto.areaId||null, dto.driveDate,
       dto.leadOfficerId||null, dto.status, dto.targetAmount||null,
       dto.amountCash||0, dto.amountDebit||0, dto.amountCredit||0, dto.amountCheque||0,
       dto.taxpayerCount||0, dto.notes||null, actorId],
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
    const r = await this.db.query(`SELECT * FROM analytics.drive_summary WHERE id = $1`, [id]);
    if (!r[0]) throw new NotFoundException('Drive not found');
    return r[0];
  }

  async updateDrive(id: string, dto: any) {
    await this.db.query(
      `UPDATE registry.tax_drive
       SET drive_name=$1, location=$2, parish=$3, area_id=$4, drive_date=$5,
           lead_officer_id=$6, status=$7, target_amount=$8,
           amount_cash=$9, amount_debit=$10, amount_credit=$11, amount_cheque=$12,
           taxpayer_count=$13, notes=$14, updated_at=NOW()
       WHERE id=$15`,
      [dto.driveName, dto.location, dto.parish, dto.areaId||null, dto.driveDate,
       dto.leadOfficerId||null, dto.status, dto.targetAmount||null,
       dto.amountCash||0, dto.amountDebit||0, dto.amountCredit||0, dto.amountCheque||0,
       dto.taxpayerCount||0, dto.notes||null, id],
    );
    return this.getDriveById(id);
  }

  async deleteDrive(id: string) {
    await this.db.query(`DELETE FROM registry.tax_drive WHERE id = $1`, [id]);
    return { message: 'Deleted', id };
  }

  async getDriveReport(period: string, from: string, to: string, parish?: string) {
    const trunc = period === 'quarterly' ? 'quarter' : period === 'yearly' ? 'year' : 'month';
    let q = `
      SELECT
        DATE_TRUNC('${trunc}', drive_date) as period,
        ${parish ? '' : 'parish,'}
        COUNT(*) as total_drives,
        SUM(taxpayer_count) as total_taxpayers,
        COALESCE(SUM(total_collected),0) as total_collected,
        COALESCE(SUM(amount_cash),0) as total_cash,
        COALESCE(SUM(amount_debit),0) as total_debit,
        COALESCE(SUM(amount_credit),0) as total_credit,
        COALESCE(SUM(amount_cheque),0) as total_cheque,
        COALESCE(SUM(target_amount),0) as total_target,
        ROUND(COALESCE(SUM(total_collected),0)/NULLIF(SUM(target_amount),0)*100,2) as achievement_pct
      FROM analytics.drive_summary
      WHERE drive_date BETWEEN $1::date AND $2::date
        AND status = 'COMPLETED'
    `;
    const p: any[] = [from, to];
    if (parish) { p.push(parish); q += ` AND parish = $${p.length}`; }
    q += ` GROUP BY 1${parish ? '' : ',2'} ORDER BY 1 DESC`;
    return this.db.query(q, p);
  }

  async getOverallStats(from?: string, to?: string) {
    const f = from || '2020-01-01';
    const t = to || new Date().toISOString().split('T')[0];
    const r = await this.db.query(
      `SELECT
         COUNT(*) as total_drives,
         COUNT(*) FILTER (WHERE status='COMPLETED') as completed_drives,
         COUNT(*) FILTER (WHERE status='PLANNED') as planned_drives,
         COALESCE(SUM(taxpayer_count),0) as total_taxpayers,
         COALESCE(SUM(total_collected),0) as total_collected,
         COALESCE(SUM(amount_cash),0) as total_cash,
         COALESCE(SUM(amount_debit),0) as total_debit,
         COALESCE(SUM(amount_credit),0) as total_credit,
         COALESCE(SUM(amount_cheque),0) as total_cheque,
         COALESCE(SUM(target_amount),0) as total_target,
         ROUND(COALESCE(SUM(total_collected),0)/NULLIF(SUM(target_amount),0)*100,2) as achievement_pct
       FROM analytics.drive_summary
       WHERE drive_date BETWEEN $1::date AND $2::date`,
      [f, t],
    );
    return r[0];
  }
}
