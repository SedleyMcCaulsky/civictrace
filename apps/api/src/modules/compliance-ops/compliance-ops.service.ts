import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ComplianceOpsService {
  private readonly logger = new Logger(ComplianceOpsService.name);
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async createPaymentPlan(caseId: string, dto: any, actorId: string) {
    const pc = await this.db.query(
      `SELECT id, composite_key FROM registry.property_case WHERE id = $1 AND deleted_at IS NULL`, [caseId],
    );
    if (!pc[0]) throw new NotFoundException('Case not found');
    const totalMonths = Math.max(1, Math.ceil(
      (new Date(dto.planEndDate).getTime() - new Date(dto.planStartDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
    ));
    const result = await this.db.query(
      `INSERT INTO registry.payment_plan
         (property_case_id, composite_key, total_arrears, down_payment, monthly_instalment,
          plan_start_date, plan_end_date, total_months, status, terms_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9,$10) RETURNING *`,
      [caseId, pc[0].composite_key, dto.totalArrears, dto.downPayment || 0, dto.monthlyInstalment,
       dto.planStartDate, dto.planEndDate, totalMonths, dto.termsNotes || null, actorId],
    );
    const plan = result[0];
    const current = new Date(dto.planStartDate);
    for (let i = 0; i < totalMonths; i++) {
      await this.db.query(
        `INSERT INTO registry.payment_plan_instalment (payment_plan_id, due_date, amount_due) VALUES ($1,$2,$3)`,
        [plan.id, new Date(current), dto.monthlyInstalment],
      );
      current.setMonth(current.getMonth() + 1);
    }
    return { ...plan, instalments: totalMonths };
  }

  async getPaymentPlans(caseId: string) {
    const plans = await this.db.query(
      `SELECT pp.*, u.full_name as created_by_name FROM registry.payment_plan pp
       LEFT JOIN identity.user u ON u.id = pp.created_by
       WHERE pp.property_case_id = $1 ORDER BY pp.created_at DESC`, [caseId],
    );
    for (const plan of plans) {
      plan.instalments = await this.db.query(
        `SELECT * FROM registry.payment_plan_instalment WHERE payment_plan_id = $1 ORDER BY due_date`, [plan.id],
      );
    }
    return plans;
  }

  async recordInstalmentPayment(instalmentId: string, amountPaid: number, receiptNumber: string) {
    const inst = await this.db.query(
      `SELECT * FROM registry.payment_plan_instalment WHERE id = $1`, [instalmentId],
    );
    if (!inst[0]) throw new NotFoundException('Instalment not found');
    const status = amountPaid >= inst[0].amount_due ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'PENDING';
    await this.db.query(
      `UPDATE registry.payment_plan_instalment SET amount_paid=$1, paid_date=CURRENT_DATE, status=$2, receipt_number=$3 WHERE id=$4`,
      [amountPaid, status, receiptNumber || null, instalmentId],
    );
    const rem = await this.db.query(
      `SELECT COUNT(*) as c FROM registry.payment_plan_instalment WHERE payment_plan_id=$1 AND status NOT IN ('PAID')`,
      [inst[0].payment_plan_id],
    );
    if (parseInt(rem[0].c) === 0) {
      await this.db.query(`UPDATE registry.payment_plan SET status='COMPLETED', updated_at=NOW() WHERE id=$1`, [inst[0].payment_plan_id]);
    }
    return { message: 'Recorded', instalmentId, status };
  }

  async createRelief(caseId: string, dto: any, actorId: string) {
    const pc = await this.db.query(`SELECT id, composite_key FROM registry.property_case WHERE id = $1`, [caseId]);
    if (!pc[0]) throw new NotFoundException('Case not found');
    const result = await this.db.query(
      `INSERT INTO registry.discretionary_relief
         (property_case_id, composite_key, application_date, applicant_name, relief_type,
          amount_requested, financial_year, status, decision_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9) RETURNING *`,
      [caseId, pc[0].composite_key, dto.applicationDate || new Date().toISOString().split('T')[0],
       dto.applicantName, dto.reliefType, dto.amountRequested || null,
       dto.financialYear || null, dto.notes || null, actorId],
    );
    return result[0];
  }

  async getReliefApplications(caseId: string) {
    return this.db.query(
      `SELECT dr.*, u.full_name as reviewed_by_name FROM registry.discretionary_relief dr
       LEFT JOIN identity.user u ON u.id = dr.reviewed_by
       WHERE dr.property_case_id = $1 ORDER BY dr.created_at DESC`, [caseId],
    );
  }

  async updateRelief(reliefId: string, dto: any, actorId: string) {
    await this.db.query(
      `UPDATE registry.discretionary_relief SET status=$1, amount_approved=$2, decision_date=$3,
       decision_notes=$4, reviewed_by=$5, updated_at=NOW() WHERE id=$6`,
      [dto.status, dto.amountApproved||null, dto.decisionDate||null, dto.decisionNotes||null, actorId, reliefId],
    );
    return { message: 'Updated', reliefId };
  }

  async addStrataLot(caseId: string, dto: any) {
    await this.db.query(`UPDATE registry.property_case SET is_strata=true, strata_plan_number=$1 WHERE id=$2`, [dto.strataPlanNumber, caseId]);
    const r = await this.db.query(
      `INSERT INTO registry.strata_lot (property_case_id, strata_plan_number, lot_number, unit_number, floor_level, owner_name, owner_contact, area_sqm) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [caseId, dto.strataPlanNumber, dto.lotNumber, dto.unitNumber||null, dto.floorLevel||null, dto.ownerName||null, dto.ownerContact||null, dto.areaSqm||null],
    );
    return r[0];
  }

  async getStrataLots(caseId: string) {
    return this.db.query(
      `SELECT sl.*, pc.valuation_number, pc.composite_key FROM registry.strata_lot sl
       JOIN registry.property_case pc ON pc.id = sl.property_case_id
       WHERE sl.property_case_id = $1 ORDER BY sl.lot_number`, [caseId],
    );
  }

  async getStrataByPlan(planNumber: string) {
    return this.db.query(
      `SELECT sl.*, pc.composite_key, pc.valuation_number, ccs.total_outstanding, ccs.status as compliance_status
       FROM registry.strata_lot sl
       JOIN registry.property_case pc ON pc.id = sl.property_case_id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE sl.strata_plan_number = $1 OR pc.strata_plan_number = $1
       ORDER BY sl.lot_number`, [planNumber],
    );
  }
}
