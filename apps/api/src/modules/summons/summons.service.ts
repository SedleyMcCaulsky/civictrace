import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class SummonsService {
  private readonly logger = new Logger(SummonsService.name);
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  getCurrentFY(): string {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() + 1 >= 4 ? `${y}-${y+1}` : `${y-1}-${y}`;
  }

  getFYDates(fy: string): { start: string; end: string } {
    const sy = parseInt(fy.split('-')[0]);
    return { start: `${sy}-04-01`, end: `${sy+1}-03-31` };
  }

  async checkEligibility(caseId: string) {
    const fy = this.getCurrentFY();
    const { start, end } = this.getFYDates(fy);
    const pc = await this.db.query(
      `SELECT pc.id, pc.composite_key, pc.owner_name_search as owner_name, pc.property_address, ccs.total_outstanding
       FROM registry.property_case pc
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE pc.id = $1 AND pc.deleted_at IS NULL`, [caseId],
    );
    if (!pc[0]) throw new NotFoundException('Case not found');

    const visits = await this.db.query(
      `SELECT COUNT(*) as count FROM delivery.notice_delivery
       WHERE property_case_id = $1 AND delivered_at BETWEEN $2::date AND $3::date`,
      [caseId, start, end],
    );
    const prevSummons = await this.db.query(
      `SELECT COUNT(*) as count FROM registry.summons WHERE property_case_id = $1`, [caseId],
    );
    const visitCount = parseInt(visits[0].count || 0);
    const outstanding = parseFloat(pc[0].total_outstanding || 0);
    const eligible = visitCount >= 2 && outstanding > 0;
    return {
      caseId, compositeKey: pc[0].composite_key, ownerName: pc[0].owner_name,
      financialYear: fy, visitCount, outstanding,
      previousSummonsCount: parseInt(prevSummons[0].count || 0),
      eligible,
      reason: eligible ? 'Eligible: 2+ visits with outstanding balance'
        : visitCount < 2 ? `Only ${visitCount} visit(s) this FY. Minimum 2 required.`
        : 'No outstanding balance.',
    };
  }

  async issueSummons(caseId: string, actorId: string, dto: { courtDate?: string; notes?: string }) {
    const check = await this.checkEligibility(caseId);
    if (!check.eligible) throw new Error(check.reason);
    const seqResult = await this.db.query(`SELECT nextval('registry.summons_seq') as n`);
    const summonsNumber = `SUM-${check.financialYear}-${String(seqResult[0].n).padStart(5,'0')}`;
    const result = await this.db.query(
      `INSERT INTO registry.summons
         (property_case_id, composite_key, owner_name, property_address, summons_number,
          financial_year, issued_date, court_date, status, issued_by, notes, previous_summons_count)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,'ISSUED',$8,$9,$10) RETURNING *`,
      [caseId, check.compositeKey, check.ownerName, '', summonsNumber, check.financialYear,
       dto.courtDate || null, actorId, dto.notes || null, check.previousSummonsCount],
    );
    return { ...result[0], caseId, compositeKey: check.compositeKey, ownerName: check.ownerName };
  }

  async getSummonsForCase(caseId: string) {
    return this.db.query(
      `SELECT s.*, u.full_name as issued_by_name FROM registry.summons s
       LEFT JOIN identity.user u ON u.id = s.issued_by
       WHERE s.property_case_id = $1 ORDER BY s.issued_date DESC`, [caseId],
    );
  }

  async getAllSummons(filters: { status?: string; financialYear?: string; parish?: string }, organisationId?: string) {
    let q = `SELECT s.id, s.summons_number, s.composite_key, s.owner_name, s.financial_year,
             s.issued_date, s.court_date, s.status, s.previous_summons_count, s.notes,
             a.name as area_name, a.parish, u.full_name as issued_by_name, ccs.total_outstanding
       FROM registry.summons s
       JOIN registry.property_case pc ON pc.id = s.property_case_id
       JOIN gis.area a ON a.id = pc.area_id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       LEFT JOIN identity.user u ON u.id = s.issued_by WHERE 1=1
       AND ($1::uuid IS NULL OR pc.organisation_id = $1::uuid)`;
    const p: any[] = [organisationId || null];
    const p: any[] = [];
    if (filters.status)        { p.push(filters.status);        q += ` AND s.status = $${p.length}`; }
    if (filters.financialYear) { p.push(filters.financialYear); q += ` AND s.financial_year = $${p.length}`; }
    if (filters.parish)        { p.push(filters.parish);        q += ` AND a.parish = $${p.length}`; }
    return this.db.query(q + ' ORDER BY s.issued_date DESC LIMIT 200', p);
  }

  async updateStatus(id: string, status: string, courtDate?: string, notes?: string) {
    await this.db.query(
      `UPDATE registry.summons SET status=$1, court_date=COALESCE($2::date,court_date), notes=COALESCE($3,notes), updated_at=NOW() WHERE id=$4`,
      [status, courtDate||null, notes||null, id],
    );
    return { message: 'Updated', id, status };
  }

  async getEligibleCases(financialYear?: string, organisationId?: string) {
    const fy = financialYear || this.getCurrentFY();
    const { start, end } = this.getFYDates(fy);
    return this.db.query(
      `SELECT pc.id, pc.composite_key, pc.owner_name_search as owner_name, pc.property_address,
              a.name as area_name, a.parish, ccs.total_outstanding,
              COUNT(nd.id) as visit_count,
              (SELECT COUNT(*) FROM registry.summons s WHERE s.property_case_id = pc.id) as previous_summons
       FROM registry.property_case pc
       JOIN gis.area a ON a.id = pc.area_id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       LEFT JOIN delivery.notice_delivery nd ON nd.property_case_id = pc.id
         AND nd.delivered_at BETWEEN $1::date AND $2::date
       WHERE pc.deleted_at IS NULL AND ccs.total_outstanding > 0
       AND ($1::uuid IS NULL OR pc.organisation_id = $1::uuid)
       GROUP BY pc.id, pc.composite_key, pc.owner_name_search, pc.property_address, a.name, a.parish, ccs.total_outstanding
       HAVING COUNT(nd.id) >= 2
       ORDER BY ccs.total_outstanding DESC`,
      [start, end],
    );
  }
}
