import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  getCurrentFY(): string {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() + 1 >= 4 ? `${y}-${y+1}` : `${y-1}-${y}`;
  }

  getFYDates(fy?: string): { start: string; end: string } {
    const year = fy || this.getCurrentFY();
    const sy = parseInt(year.split('-')[0]);
    return { start: `${sy}-04-01`, end: `${sy+1}-03-31` };
  }

  async getArrearsReport(filters: { parish?: string; region?: string; financialYear?: string }) {
    const fy = filters.financialYear || this.getCurrentFY();
    let q = `
      SELECT a.name as area_name, a.parish, a.region,
             COUNT(DISTINCT pc.id) as total_cases,
             COUNT(DISTINCT pc.id) FILTER (WHERE ccs.status = 'DELINQUENT') as delinquent_cases,
             SUM(tb.amount_due) as total_levied,
             SUM(tb.amount_paid) as total_collected,
             SUM(tb.amount_due - tb.amount_paid) as total_outstanding,
             ROUND(SUM(tb.amount_paid)/NULLIF(SUM(tb.amount_due),0)*100,2) as collection_rate_pct,
             COUNT(DISTINCT s.id) as summons_issued,
             COUNT(DISTINCT pp.id) as active_payment_plans
      FROM registry.property_case pc
      JOIN gis.area a ON a.id = pc.area_id
      LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
      LEFT JOIN registry.tax_balance tb ON tb.property_case_id = pc.id
      LEFT JOIN registry.summons s ON s.property_case_id = pc.id AND s.financial_year = $1
      LEFT JOIN registry.payment_plan pp ON pp.property_case_id = pc.id AND pp.status = 'ACTIVE'
      WHERE pc.deleted_at IS NULL
    `;
    const p: any[] = [fy];
    if (filters.parish) { p.push(filters.parish); q += ` AND a.parish = $${p.length}`; }
    if (filters.region) { p.push(filters.region); q += ` AND a.region = $${p.length}`; }
    q += ' GROUP BY a.name, a.parish, a.region ORDER BY total_outstanding DESC NULLS LAST';
    const rows = await this.db.query(q, p);
    const totals = await this.db.query(
      `SELECT SUM(tb.amount_due) as total_levied, SUM(tb.amount_paid) as total_collected,
              SUM(tb.amount_due-tb.amount_paid) as total_outstanding,
              COUNT(DISTINCT pc.id) as total_cases
       FROM registry.tax_balance tb
       JOIN registry.property_case pc ON pc.id = tb.property_case_id
       WHERE pc.deleted_at IS NULL`,
    );
    return { rows, totals: totals[0], financialYear: fy };
  }

  async getCollectionsReport(period: Period, from: string, to: string, parish?: string) {
    const trunc = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : period === 'quarterly' ? 'quarter' : 'year';
    let q = `
      SELECT DATE_TRUNC('${trunc}', tb.updated_at) as period,
             a.parish, a.region,
             COUNT(DISTINCT tb.property_case_id) as cases_with_activity,
             SUM(tb.amount_paid) as amount_collected,
             SUM(tb.amount_due) as amount_levied,
             ROUND(SUM(tb.amount_paid)/NULLIF(SUM(tb.amount_due),0)*100,2) as collection_rate_pct
      FROM registry.tax_balance tb
      JOIN registry.property_case pc ON pc.id = tb.property_case_id
      JOIN gis.area a ON a.id = pc.area_id
      WHERE tb.updated_at BETWEEN $1::date AND $2::date + interval '1 day' AND pc.deleted_at IS NULL
    `;
    const p: any[] = [from, to];
    if (parish) { p.push(parish); q += ` AND a.parish = $${p.length}`; }
    return this.db.query(q + ' GROUP BY 1,2,3 ORDER BY 1 DESC, amount_collected DESC', p);
  }

  async getOverallCollections(financialYear?: string) {
    const fy = financialYear || '2024-2025';
    const r = await this.db.query(
      `SELECT SUM(tb.amount_due) as total_levied,
              SUM(tb.amount_paid) as total_collected,
              SUM(tb.amount_due-tb.amount_paid) as total_outstanding,
              ROUND(SUM(tb.amount_paid)/NULLIF(SUM(tb.amount_due),0)*100,2) as collection_rate,
              COUNT(DISTINCT pc.id) as total_cases,
              COUNT(DISTINCT pc.id) FILTER (WHERE tb.amount_paid > 0) as cases_with_payment,
              COUNT(DISTINCT pc.id) FILTER (WHERE tb.amount_paid = 0) as cases_no_payment,
              COUNT(DISTINCT pp.id) as active_payment_plans,
              COUNT(DISTINCT s.id) as summons_issued_fy,
              COUNT(DISTINCT dr.id) FILTER (WHERE dr.status = 'APPROVED') as relief_approved
       FROM registry.tax_balance tb
       JOIN registry.property_case pc ON pc.id = tb.property_case_id
       LEFT JOIN registry.payment_plan pp ON pp.property_case_id = pc.id AND pp.status = 'ACTIVE'
       LEFT JOIN registry.summons s ON s.property_case_id = pc.id AND s.financial_year = $1
       LEFT JOIN registry.discretionary_relief dr ON dr.property_case_id = pc.id AND dr.financial_year = $1
       WHERE pc.deleted_at IS NULL
       AND tb.tax_year = CAST(SPLIT_PART($1, '-', 1) AS SMALLINT)`,
      [fy],
    );
    return { ...r[0], financialYear: fy };
  }

  async getDelinquencyReport(filters: { parish?: string; minYears?: number; minAmount?: number }) {
    let q = `
      SELECT pc.composite_key, pc.owner_name_search as owner_name, pc.property_address,
             pc.property_type, pc.is_strata, a.name as area_name, a.parish, a.region,
             ccs.status as compliance_status, ccs.risk_level, ccs.total_outstanding, ccs.years_outstanding,
             ccs.last_delivery_status, ccs.last_delivery_at,
             (SELECT COUNT(*) FROM registry.summons s WHERE s.property_case_id = pc.id) as total_summons,
             (SELECT COUNT(*) FROM registry.summons s WHERE s.property_case_id = pc.id AND s.status NOT IN ('WITHDRAWN','SETTLED')) as active_summons,
             (SELECT COUNT(*) FROM registry.payment_plan pp WHERE pp.property_case_id = pc.id AND pp.status = 'ACTIVE') as active_plans,
             (SELECT COUNT(*) FROM registry.discretionary_relief dr WHERE dr.property_case_id = pc.id AND dr.status = 'PENDING') as pending_relief,
             (SELECT COUNT(*) FROM delivery.notice_delivery nd WHERE nd.property_case_id = pc.id) as total_visits
      FROM registry.property_case pc
      JOIN gis.area a ON a.id = pc.area_id
      LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
      WHERE pc.deleted_at IS NULL AND ccs.status = 'DELINQUENT'
    `;
    const p: any[] = [];
    if (filters.parish)    { p.push(filters.parish);    q += ` AND a.parish = $${p.length}`; }
    if (filters.minYears)  { p.push(filters.minYears);  q += ` AND ccs.years_outstanding >= $${p.length}`; }
    if (filters.minAmount) { p.push(filters.minAmount); q += ` AND ccs.total_outstanding >= $${p.length}`; }
    return this.db.query(q + ' ORDER BY ccs.total_outstanding DESC NULLS LAST', p);
  }

  async getForecast(monthsAhead: number = 6) {
    const monthly = await this.db.query(
      `SELECT DATE_TRUNC('month', tb.updated_at) as month, SUM(tb.amount_paid) as collected
       FROM registry.tax_balance tb
       JOIN registry.property_case pc ON pc.id = tb.property_case_id
       WHERE pc.deleted_at IS NULL AND tb.updated_at >= NOW() - INTERVAL '12 months'
       GROUP BY 1 ORDER BY 1`,
    );
    const plans = await this.db.query(
      `SELECT SUM(ppi.amount_due) as expected, DATE_TRUNC('month', ppi.due_date) as month
       FROM registry.payment_plan_instalment ppi
       JOIN registry.payment_plan pp ON pp.id = ppi.payment_plan_id
       WHERE pp.status = 'ACTIVE' AND ppi.status = 'PENDING' AND ppi.due_date >= CURRENT_DATE
       GROUP BY 2 ORDER BY 2 LIMIT $1`, [monthsAhead],
    );
    const totalCollected: number = monthly.reduce((s: number, r: any) => s + Number(r.collected || 0), 0);
    const avgMonthly: number = monthly.length > 0 ? totalCollected / monthly.length : 0;
    const forecast: any[] = [];
    for (let i = 1; i <= monthsAhead; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      const ms: string = d.toISOString().slice(0, 7);
      const matchedPlan: any = plans.find((p: any) => {
        const raw: string = p.month ? String(p.month) : '';
        return raw.slice(0, 7) === ms;
      });
      const planAmount: number = matchedPlan ? Number(matchedPlan.expected || 0) : 0;
      forecast.push({
        month: ms,
        historicalAverage: Math.round(avgMonthly),
        plannedInstalments: planAmount,
        projectedTotal: Math.round(avgMonthly + planAmount),
      });
    }
    return { forecast, avgMonthlyCollection: Math.round(avgMonthly) };
  }

  async getBottleneckAnalysis() {
    const [deliveryStatus, areaGaps, officerPerf, unvisited] = await Promise.all([
      this.db.query(`SELECT status, COUNT(*) as count, ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(),2) as pct FROM delivery.notice_delivery GROUP BY status ORDER BY count DESC`),
      this.db.query(`SELECT a.name, a.parish, COUNT(DISTINCT pc.id) as total, COUNT(DISTINCT nd.property_case_id) as visited, COUNT(DISTINCT pc.id)-COUNT(DISTINCT nd.property_case_id) as unvisited, ROUND(COUNT(DISTINCT nd.property_case_id)*100.0/NULLIF(COUNT(DISTINCT pc.id),0),2) as coverage_pct, SUM(ccs.total_outstanding) as outstanding FROM gis.area a LEFT JOIN registry.property_case pc ON pc.area_id=a.id AND pc.deleted_at IS NULL LEFT JOIN delivery.notice_delivery nd ON nd.property_case_id=pc.id LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id=pc.id GROUP BY a.name,a.parish ORDER BY unvisited DESC`),
      this.db.query(`SELECT u.full_name as officer, COUNT(*) as total, COUNT(*) FILTER (WHERE nd.status='DELIVERED') as delivered, ROUND(COUNT(*) FILTER(WHERE nd.status='DELIVERED')*100.0/NULLIF(COUNT(*),0),2) as rate FROM delivery.notice_delivery nd JOIN identity.user u ON u.id=nd.officer_id WHERE nd.delivered_at>=NOW()-INTERVAL '90 days' GROUP BY u.full_name ORDER BY rate ASC`),
      this.db.query(`SELECT COUNT(*) as count, SUM(ccs.total_outstanding) as outstanding FROM registry.property_case pc LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id=pc.id WHERE pc.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM delivery.notice_delivery nd WHERE nd.property_case_id=pc.id)`),
    ]);
    return { deliveryStatus, areaGaps, officerPerf, unvisited: unvisited[0] };
  }
}
