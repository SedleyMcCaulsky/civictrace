import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `You are the ValuGrid Compliance Intelligence Agent for Jamaica's property tax system.

Your role: Analyse each property case and recommend ONE action from:
- ISSUE_SUMMONS: Outstanding balance, no active summons (visits help but not required)
- CREATE_PAYMENT_PLAN: Owner cooperative, large balance, no active plan
- FLAG_RELIEF: Hardship indicators, elderly/pensioner, should apply for relief
- ESCALATE: 3+ years outstanding OR large balance over J$100,000 with no payment history
- MONITOR: Recent activity, payment plan active, give more time
- NO_ACTION: Compliant or recently resolved

Response MUST be valid JSON only. No preamble. No markdown. Example:
{
  "action": "ISSUE_SUMMONS",
  "confidence": "HIGH",
  "reasoning": "Two field visits in FY 2026-2027 with no payment. Outstanding J$520,000 for 4 years. Owner refused notice on second visit. Legal enforcement warranted.",
  "parameters": {
    "courtDate": "2026-07-15",
    "urgency": "HIGH"
  }
}`;

@Injectable()
export class ComplianceAgentService {
  private readonly logger = new Logger(ComplianceAgentService.name);
  private readonly groq: Groq;

  constructor(@InjectDataSource() private readonly db: DataSource) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  private getCurrentFY(): string {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() + 1 >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }

  async getCasesForAnalysis(organisationId?: string,): Promise<any[]> {
    const fy = this.getCurrentFY();
    const fyStart = fy.split('-')[0] + '-04-01';
    const fyEnd = (parseInt(fy.split('-')[1])) + '-03-31';

    return this.db.query(`
      SELECT
        pc.id, pc.composite_key, pc.owner_name_search as owner_name,
        pc.property_address, pc.property_type, pc.is_strata,
        a.name as area_name, a.parish, a.region,
        ccs.status as compliance_status,
        ccs.risk_level,
        COALESCE(ccs.total_outstanding, 0) as total_outstanding,
        COALESCE(ccs.years_outstanding, 0) as years_outstanding,
        ccs.last_delivery_status,
        ccs.last_delivery_at,

        -- FY visits
        COUNT(DISTINCT nd.id) FILTER (
          WHERE nd.delivered_at BETWEEN $1::date AND $2::date
        ) as fy_visit_count,

        -- Total visits
        COUNT(DISTINCT nd.id) as total_visits,

        -- Active summons
        (SELECT COUNT(*) FROM registry.summons s
         WHERE s.property_case_id = pc.id
           AND s.status NOT IN ('WITHDRAWN','SETTLED')) as active_summons,

        -- Summons this FY
        (SELECT COUNT(*) FROM registry.summons s
         WHERE s.property_case_id = pc.id
           AND s.financial_year = $3) as fy_summons,

        -- All summons ever
        (SELECT COUNT(*) FROM registry.summons s
         WHERE s.property_case_id = pc.id) as total_summons,

        -- Active payment plans
        (SELECT COUNT(*) FROM registry.payment_plan pp
         WHERE pp.property_case_id = pc.id
           AND pp.status = 'ACTIVE') as active_plans,

        -- Pending relief
        (SELECT COUNT(*) FROM registry.discretionary_relief dr
         WHERE dr.property_case_id = pc.id
           AND dr.status = 'PENDING') as pending_relief,

        -- Already in queue today
        (SELECT COUNT(*) FROM registry.agent_action_queue aq
         WHERE aq.property_case_id = pc.id
           AND aq.run_date = CURRENT_DATE
           AND aq.status = 'PENDING') as in_queue_today

      FROM registry.property_case pc
      JOIN gis.area a ON a.id = pc.area_id
      LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
      LEFT JOIN delivery.notice_delivery nd ON nd.property_case_id = pc.id

      WHERE pc.deleted_at IS NULL
        AND ccs.status = 'DELINQUENT'
        AND COALESCE(ccs.total_outstanding, 0) > 0
        AND ($4::uuid IS NULL OR pc.organisation_id = $4::uuid)

      GROUP BY pc.id, pc.composite_key, pc.owner_name_search, pc.property_address,
               pc.property_type, pc.is_strata, a.name, a.parish, a.region,
               ccs.status, ccs.risk_level, ccs.total_outstanding,
               ccs.years_outstanding, ccs.last_delivery_status, ccs.last_delivery_at

      HAVING (SELECT COUNT(*) FROM registry.agent_action_queue aq
              WHERE aq.property_case_id = pc.id
                AND aq.run_date = CURRENT_DATE
                AND aq.status = 'PENDING') = 0

      ORDER BY ccs.total_outstanding DESC NULLS LAST
      LIMIT 50
    `, [fyStart, fyEnd, fy, organisationId || null]);
  }

  async analyseCase(caseData: any): Promise<any> {
    const prompt = `Analyse this Jamaica property tax case and recommend an action.

CASE: ${caseData.composite_key}
Owner: ${caseData.owner_name}
Address: ${caseData.property_address}
Type: ${caseData.property_type}${caseData.is_strata ? ' (STRATA)' : ''}
Parish: ${caseData.parish}, ${caseData.area_name}

FINANCIALS:
- Total Outstanding: J$${Number(caseData.total_outstanding).toLocaleString()}
- Years Outstanding: ${caseData.years_outstanding}
- Risk Level: ${caseData.risk_level}

ENFORCEMENT HISTORY:
- Visits this FY: ${caseData.fy_visit_count} / Total visits ever: ${caseData.total_visits}
- Last visit outcome: ${caseData.last_delivery_status || 'None'}
- Active summons: ${caseData.active_summons}
- Summons this FY: ${caseData.fy_summons}
- Total summons ever: ${caseData.total_summons}
- Active payment plans: ${caseData.active_plans}
- Pending relief applications: ${caseData.pending_relief}

Recommend the single best action. Return JSON only.`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 400,
      });

      const raw = completion.choices[0]?.message?.content || '{}';
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (err) {
      this.logger.error(`AI analysis failed for ${caseData.composite_key}:`, err);
      return {
        action: 'MONITOR',
        confidence: 'LOW',
        reasoning: 'AI analysis unavailable. Manual review required.',
        parameters: {},
      };
    }
  }

  async writeToQueue(caseData: any, recommendation: any): Promise<void> {
    await this.db.query(`
      INSERT INTO registry.agent_action_queue (
        property_case_id, composite_key, owner_name, run_date,
        recommended_action, confidence, reasoning, suggested_parameters,
        total_outstanding, years_outstanding, visit_count,
        last_delivery_status, active_summons, active_plans, pending_relief, risk_level, organisation_id
      ) VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
      caseData.id,
      caseData.composite_key,
      caseData.owner_name,
      recommendation.action || 'MONITOR',
      recommendation.confidence || 'MEDIUM',
      recommendation.reasoning || '',
      JSON.stringify(recommendation.parameters || {}),
      caseData.total_outstanding,
      caseData.years_outstanding,
      caseData.fy_visit_count,
      caseData.last_delivery_status,
      caseData.active_summons,
      caseData.active_plans,
      caseData.pending_relief,
      caseData.risk_level,
    ]);
  }

  async executeApprovedAction(queueItemId: string, reviewerId: string): Promise<any> {
    const items = await this.db.query(
      `SELECT aq.*, pc.id as case_id FROM registry.agent_action_queue aq
       JOIN registry.property_case pc ON pc.id = aq.property_case_id
       WHERE aq.id = $1 AND aq.status = 'APPROVED'`,
      [queueItemId],
    );
    const item = items[0];
    if (!item) throw new Error('Queue item not found or not approved');

    const params = item.suggested_parameters || {};
    let result: any = {};

    try {
      switch (item.recommended_action) {
        case 'ISSUE_SUMMONS': {
          const seqRes = await this.db.query(`SELECT nextval('registry.summons_seq') as n`);
          const fy = this.getCurrentFY();
          const summonsNumber = `SUM-${fy}-${String(seqRes[0].n).padStart(5,'0')}`;
          const r = await this.db.query(
            `INSERT INTO registry.summons
               (property_case_id, composite_key, owner_name, property_address,
                summons_number, financial_year, issued_date, court_date, status, issued_by, notes)
             VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,'ISSUED',$8,$9)
             RETURNING id, summons_number`,
            [item.property_case_id, item.composite_key, item.owner_name, '',
             summonsNumber, fy, params.courtDate || null, reviewerId,
             `Auto-executed by Compliance Agent. ${item.reasoning}`],
          );
          result = { summonsNumber: r[0].summons_number, summonsId: r[0].id };
          break;
        }

        case 'CREATE_PAYMENT_PLAN': {
          const monthly = params.monthlyInstalment || Math.round(Number(item.total_outstanding) / 12);
          const r = await this.db.query(
            `INSERT INTO registry.payment_plan
               (property_case_id, composite_key, total_arrears, down_payment,
                monthly_instalment, plan_start_date, plan_end_date, total_months, status, terms_notes, created_by)
             VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,CURRENT_DATE + INTERVAL '12 months',12,'ACTIVE',$6,$7)
             RETURNING id`,
            [item.property_case_id, item.composite_key, item.total_outstanding, 0,
             monthly, `Agent-recommended plan. ${item.reasoning}`, reviewerId],
          );
          result = { planId: r[0].id, monthlyInstalment: monthly };
          break;
        }

        case 'FLAG_RELIEF': {
          const r = await this.db.query(
            `INSERT INTO registry.discretionary_relief
               (property_case_id, composite_key, application_date, applicant_name,
                relief_type, financial_year, status, decision_notes, created_by)
             VALUES ($1,$2,CURRENT_DATE,$3,'HARDSHIP',$4,'PENDING',$5,$6)
             RETURNING id`,
            [item.property_case_id, item.composite_key, item.owner_name,
             this.getCurrentFY(), `Flagged by Compliance Agent: ${item.reasoning}`, reviewerId],
          );
          result = { reliefId: r[0].id };
          break;
        }

        case 'ESCALATE':
          await this.db.query(
            `UPDATE registry.property_case SET updated_at = NOW() WHERE id = $1`,
            [item.property_case_id],
          );
          result = { escalated: true, note: 'Case flagged for legal referral' };
          break;

        default:
          result = { action: item.recommended_action, note: 'Logged — no automated execution for this action type' };
      }

      await this.db.query(
        `UPDATE registry.agent_action_queue
         SET status='EXECUTED', executed_at=NOW(), execution_result=$1, reviewed_by=$2, reviewed_at=NOW()
         WHERE id=$3`,
        [JSON.stringify(result), reviewerId, queueItemId],
      );

      return result;
    } catch (err: any) {
      await this.db.query(
        `UPDATE registry.agent_action_queue SET status='PENDING', review_notes=$1 WHERE id=$2`,
        [`Execution failed: ${err.message}`, queueItemId],
      );
      throw err;
    }
  }

  async runNightlyAgent(organisationId?: string): Promise<{ analysed: number; queued: number; skipped: number }> {
    this.logger.log('Compliance Agent starting nightly run...');
    const cases = await this.getCasesForAnalysis(organisationId);
    this.logger.log(`Found ${cases.length} cases to analyse`);

    let queued = 0;
    let skipped = 0;

    for (const c of cases) {
      try {
        const recommendation = await this.analyseCase(c);
        if (recommendation.action && recommendation.action !== 'NO_ACTION') {
          await this.writeToQueue(c, recommendation);
          queued++;
          this.logger.log(`Queued ${recommendation.action} (${recommendation.confidence}) for ${c.composite_key}`);
        } else {
          skipped++;
        }
        await new Promise(r => setTimeout(r, 300)); // rate limit
      } catch (err) {
        this.logger.error(`Failed to analyse ${c.composite_key}:`, err);
        skipped++;
      }
    }

    this.logger.log(`Nightly run complete: ${queued} queued, ${skipped} skipped`);
    return { analysed: cases.length, queued, skipped };
  }

  async getQueue(status?: string, organisationId?: string): Promise<any[]> {
    let q = `
      SELECT aq.*, u.full_name as reviewed_by_name
      FROM registry.agent_action_queue aq
      LEFT JOIN identity.user u ON u.id = aq.reviewed_by
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) { params.push(status); q += ` AND aq.status = $${params.length}`; }
    if (organisationId) { params.push(organisationId); q += ` AND aq.organisation_id = $${params.length}`; }
    q += ` ORDER BY aq.created_at DESC LIMIT 200`;
    return this.db.query(q, params);
  }

  async approveQueueItem(id: string, reviewerId: string, notes?: string): Promise<any> {
    await this.db.query(
      `UPDATE registry.agent_action_queue
       SET status='APPROVED', reviewed_by=$1, reviewed_at=NOW(), review_notes=$2
       WHERE id=$3 AND status='PENDING'`,
      [reviewerId, notes || null, id],
    );
    return this.executeApprovedAction(id, reviewerId);
  }

  async rejectQueueItem(id: string, reviewerId: string, notes: string): Promise<any> {
    await this.db.query(
      `UPDATE registry.agent_action_queue
       SET status='REJECTED', reviewed_by=$1, reviewed_at=NOW(), review_notes=$2
       WHERE id=$3`,
      [reviewerId, notes, id],
    );
    return { message: 'Rejected', id };
  }

  async getQueueStats(organisationId?: string): Promise<any> {
    const stats = await this.db.query(`
      SELECT
        status,
        recommended_action,
        COUNT(*) as count,
        SUM(total_outstanding) as total_outstanding
      FROM registry.agent_action_queue
      WHERE run_date >= CURRENT_DATE - INTERVAL '30 days'
        AND ($1::uuid IS NULL OR organisation_id = $1::uuid)
      GROUP BY status, recommended_action
      ORDER BY status, count DESC
    `, [organisationId || null]);
    return stats;
  }

  async clearQueue(status?: string, organisationId?: string): Promise<{ cleared: number }> {
    const allowed = ['REJECTED', 'EXECUTED', 'PENDING'];
    const target = status && allowed.includes(status.toUpperCase())
      ? [status.toUpperCase()]
      : allowed;
    const placeholders = target.map((_, i) => `$${i + 1}`).join(', ');
    const result = await this.db.query(
      `DELETE FROM registry.agent_action_queue WHERE status IN (${placeholders}) RETURNING id`,
      target
    );
    return { cleared: result.length };
  }

}