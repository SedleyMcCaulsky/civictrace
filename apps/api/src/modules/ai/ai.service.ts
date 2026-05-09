import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Groq from 'groq-sdk';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: any;

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private getClient() { if (!this.client) { const Groq = require('groq-sdk').default || require('groq-sdk'); this.client = new Groq({ apiKey: process.env.GROQ_API_KEY || 'placeholder' }); } return this.client; }

  private async chat(prompt: string, maxTokens = 1500): Promise<string> {
    const response = await this.getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content || '';
  }

  async generateComplianceNarrative(caseId: string): Promise<any> {
    const caseResult = await this.db.query(
      `SELECT pc.id, pc.composite_key, pc.owner_name_search as owner_name,
              pc.property_address, pc.property_type, pc.area_code,
              a.name as area_name, a.parish,
              ccs.status as compliance_status, ccs.risk_level,
              ccs.total_outstanding, ccs.years_outstanding,
              ccs.last_delivery_status, ccs.last_delivery_at
       FROM registry.property_case pc
       JOIN gis.area a ON a.id = pc.area_id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE pc.id = $1 AND pc.deleted_at IS NULL`,
      [caseId],
    );
    const propertyCase = caseResult[0];
    if (!propertyCase) throw new Error(`Case not found: ${caseId}`);

    const balances = await this.db.query(
      `SELECT tax_year, amount_due, amount_paid, balance, status
       FROM registry.tax_balance WHERE property_case_id = $1 ORDER BY tax_year DESC`,
      [caseId],
    );

    const deliveries = await this.db.query(
      `SELECT nd.status, nd.notes, nd.delivered_at, nd.recipient_name, u.full_name as officer_name
       FROM delivery.notice_delivery nd
       JOIN identity.user u ON u.id = nd.officer_id
       WHERE nd.property_case_id = $1 ORDER BY nd.delivered_at DESC LIMIT 10`,
      [caseId],
    );

    const prompt = `You are a senior compliance officer at a Jamaican government tax authority.
Generate a formal, professional compliance narrative report for the following property tax case.

PROPERTY CASE DETAILS:
- Composite Key: ${propertyCase.composite_key}
- Owner: ${propertyCase.owner_name}
- Address: ${propertyCase.property_address}
- Area: ${propertyCase.area_name}, ${propertyCase.parish}
- Property Type: ${propertyCase.property_type}
- Compliance Status: ${propertyCase.compliance_status}
- Risk Level: ${propertyCase.risk_level}
- Total Outstanding: J$${Number(propertyCase.total_outstanding || 0).toLocaleString()}
- Years Outstanding: ${propertyCase.years_outstanding}

TAX BALANCE HISTORY:
${balances.map((b: any) => `- ${b.tax_year}: Due J$${Number(b.amount_due).toLocaleString()}, Paid J$${Number(b.amount_paid).toLocaleString()}, Balance J$${Number(b.balance || b.amount_due - b.amount_paid).toLocaleString()} (${b.status})`).join('\n')}

DELIVERY HISTORY:
${deliveries.length === 0 ? 'No delivery attempts recorded.' : deliveries.map((d: any) => `- ${new Date(d.delivered_at).toLocaleDateString('en-JM')}: ${d.status} by ${d.officer_name}${d.notes ? ` — Notes: ${d.notes}` : ''}${d.recipient_name ? ` — Received by: ${d.recipient_name}` : ''}`).join('\n')}

Generate a formal compliance narrative with these sections:
1. Executive Summary
2. Property and Ownership Details
3. Outstanding Tax Liability Assessment
4. Notice Delivery History and Outcomes
5. Risk Assessment and Classification
6. Recommended Compliance Action

Use formal government language. Be factual and precise.`;

    const narrative = await this.chat(prompt, 1500);

    return {
      caseId,
      compositeKey: propertyCase.composite_key,
      ownerName: propertyCase.owner_name,
      narrative,
      generatedAt: new Date().toISOString(),
    };
  }

  async generateRiskScore(caseId: string): Promise<any> {
    const caseResult = await this.db.query(
      `SELECT pc.composite_key, pc.property_type, a.parish,
              ccs.total_outstanding, ccs.years_outstanding, ccs.last_delivery_status,
              (SELECT COUNT(*) FROM delivery.notice_delivery nd WHERE nd.property_case_id = pc.id) as delivery_count,
              (SELECT COUNT(*) FROM delivery.notice_delivery nd WHERE nd.property_case_id = pc.id AND nd.status = 'DELIVERED') as delivered_count,
              (SELECT COUNT(*) FROM delivery.notice_delivery nd WHERE nd.property_case_id = pc.id AND nd.status IN ('REFUSED','ACCESS_DENIED')) as refused_count
       FROM registry.property_case pc
       JOIN gis.area a ON a.id = pc.area_id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE pc.id = $1`,
      [caseId],
    );
    const c = caseResult[0];
    if (!c) throw new Error(`Case not found: ${caseId}`);

    const prompt = `You are a tax compliance risk analyst. Score this property tax case 0-100 (100 = highest risk).

Case: Outstanding J$${Number(c.total_outstanding || 0).toLocaleString()}, ${c.years_outstanding} years, ${c.property_type}, ${c.parish}
Deliveries: ${c.delivery_count} total, ${c.delivered_count} delivered, ${c.refused_count} refused/denied
Last status: ${c.last_delivery_status || 'None'}

Respond ONLY with valid JSON, no markdown, no explanation:
{"score":<0-100>,"level":"<CRITICAL|HIGH|MEDIUM|LOW>","factors":["<f1>","<f2>","<f3>"],"recommendation":"<one sentence>"}`;

    const text = await this.chat(prompt, 300);
    let riskData: any = {};
    try {
      riskData = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      riskData = { score: 50, level: 'MEDIUM', factors: ['Parse error'], recommendation: 'Manual review required' };
    }

    await this.db.query(
      `UPDATE compliance.case_compliance_status
       SET risk_level = $1, risk_score = $2, risk_score_reason = $3, updated_at = NOW()
       WHERE property_case_id = $4`,
      [riskData.level, riskData.score, riskData.factors?.join('; '), caseId],
    ).catch(() => {});

    return { caseId, compositeKey: c.composite_key, ...riskData };
  }

  async generateExecutiveSummary(): Promise<any> {
    const stats = await this.db.query(
      `SELECT
         COUNT(DISTINCT pc.id) as total_cases,
         COUNT(DISTINCT pc.id) FILTER (WHERE ccs.status = 'DELINQUENT') as delinquent,
         SUM(ccs.total_outstanding) as total_outstanding,
         (SELECT COUNT(*) FROM delivery.notice_delivery WHERE delivered_at >= NOW() - INTERVAL '30 days') as deliveries_30d,
         (SELECT COUNT(*) FROM delivery.notice_delivery WHERE status = 'DELIVERED' AND delivered_at >= NOW() - INTERVAL '30 days') as delivered_30d,
         (SELECT SUM(total_amount) FROM reconciliation.reconciliation_batch WHERE status = 'COMPLETE') as total_reconciled
       FROM registry.property_case pc
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE pc.deleted_at IS NULL`,
    );
    const s = stats[0];

    const topAreas = await this.db.query(
      `SELECT a.name, a.parish, COUNT(pc.id) as cases, SUM(ccs.total_outstanding) as outstanding
       FROM gis.area a
       JOIN registry.property_case pc ON pc.area_id = a.id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE pc.deleted_at IS NULL
       GROUP BY a.name, a.parish ORDER BY outstanding DESC NULLS LAST LIMIT 5`,
    );

    const prompt = `You are a senior government compliance executive. Generate a concise weekly executive summary.

STATISTICS:
- Total Cases: ${s.total_cases}, Delinquent: ${s.delinquent}
- Total Outstanding: J$${Number(s.total_outstanding || 0).toLocaleString()}
- Deliveries (30 days): ${s.deliveries_30d}, Delivered: ${s.delivered_30d}
- Total Reconciled: J$${Number(s.total_reconciled || 0).toLocaleString()}

TOP AREAS: ${topAreas.map((a: any) => `${a.name} J$${Number(a.outstanding || 0).toLocaleString()}`).join(', ')}

Write 3 professional paragraphs: portfolio status, field operations, priority actions. Formal government language.`;

    const summary = await this.chat(prompt, 800);
    return { summary, stats: s, topAreas, generatedAt: new Date().toISOString() };
  }

  async formalizeOfficerNote(note: string, context: { compositeKey: string; ownerName: string; address: string; status: string }): Promise<any> {
    const prompt = `You are a compliance officer at a Jamaican tax authority. Convert this field officer's informal note into a formal compliance record entry.

Property: ${context.compositeKey}, Owner: ${context.ownerName}, Address: ${context.address}, Status: ${context.status}
Officer Note: "${note}"

Rewrite as a formal 2-3 sentence compliance record entry. Past tense, precise, factual. Do not add information not in the original note.`;

    const formal = await this.chat(prompt, 300);
    return { original: note, formalized: formal };
  }
}
