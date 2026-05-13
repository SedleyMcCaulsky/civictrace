import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private getResend(): Resend {
    if (!this.resend) {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error('RESEND_API_KEY not configured');
      this.resend = new Resend(key);
    }
    return this.resend;
  }

  private getCurrentFY(): string {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() + 1 >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }

  async getCollectionsSummary() {
    const fy = this.getCurrentFY();
    const [overall, byArea, summons, plans, bottleneck] = await Promise.all([
      this.db.query(`
        SELECT
          SUM(tb.amount_due) as total_levied,
          SUM(tb.amount_paid) as total_collected,
          SUM(tb.amount_due - tb.amount_paid) as total_outstanding,
          ROUND(SUM(tb.amount_paid)/NULLIF(SUM(tb.amount_due),0)*100,2) as collection_rate,
          COUNT(DISTINCT pc.id) as total_cases,
          COUNT(DISTINCT pc.id) FILTER (WHERE tb.amount_paid > 0) as cases_with_payment,
          COUNT(DISTINCT pc.id) FILTER (WHERE tb.amount_paid = 0) as cases_no_payment
        FROM registry.tax_balance tb
        JOIN registry.property_case pc ON pc.id = tb.property_case_id
        WHERE pc.deleted_at IS NULL
      `),
      this.db.query(`
        SELECT a.name as area_name, a.parish,
               COUNT(DISTINCT pc.id) as cases,
               SUM(tb.amount_due) as levied,
               SUM(tb.amount_paid) as collected,
               SUM(tb.amount_due - tb.amount_paid) as outstanding,
               ROUND(SUM(tb.amount_paid)/NULLIF(SUM(tb.amount_due),0)*100,1) as rate_pct
        FROM registry.tax_balance tb
        JOIN registry.property_case pc ON pc.id = tb.property_case_id
        JOIN gis.area a ON a.id = pc.area_id
        WHERE pc.deleted_at IS NULL
        GROUP BY a.name, a.parish
        ORDER BY outstanding DESC NULLS LAST
        LIMIT 10
      `),
      this.db.query(`SELECT status, COUNT(*) as count FROM registry.summons GROUP BY status ORDER BY count DESC`),
      this.db.query(`SELECT status, COUNT(*) as count FROM registry.payment_plan GROUP BY status`),
      this.db.query(`
        SELECT COUNT(*) as unvisited, SUM(ccs.total_outstanding) as unvisited_outstanding
        FROM registry.property_case pc
        LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
        WHERE pc.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM delivery.notice_delivery nd WHERE nd.property_case_id = pc.id)
      `),
    ]);
    return { overall: overall[0], byArea, summons, plans, bottleneck: bottleneck[0], fy };
  }

  buildEmailHtml(data: any): string {
    const { overall, byArea, summons, plans, bottleneck, fy } = data;
    const now = new Date().toLocaleDateString('en-JM', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const fmt = (n: any) => n ? `J$${Number(n).toLocaleString()}` : 'J$0';
    const pct = (n: any) => n ? `${Number(n).toFixed(2)}%` : '0.00%';

    const areaRows = (byArea || []).map((a: any, i: number) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8faff'}">
        <td style="padding:8px 12px;font-size:13px;color:#0d1326;font-weight:600">${a.area_name}</td>
        <td style="padding:8px 12px;font-size:13px;color:#5C6A8A">${a.parish}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:center">${a.cases}</td>
        <td style="padding:8px 12px;font-size:13px;color:#059669;font-weight:700">${fmt(a.collected)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#E53E3E;font-weight:700">${fmt(a.outstanding)}</td>
        <td style="padding:8px 12px;font-size:13px;font-weight:800;color:${Number(a.rate_pct) > 50 ? '#059669' : Number(a.rate_pct) > 20 ? '#D97706' : '#E53E3E'}">${pct(a.rate_pct)}</td>
      </tr>`).join('');

    const summonsRows = (summons || []).map((s: any) => `
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#0d1326">${s.status.replace(/_/g,' ')}</td>
        <td style="padding:6px 12px;font-size:13px;font-weight:700;color:#2979FF;text-align:center">${s.count}</td>
      </tr>`).join('');

    const statCards = [
      { label:'Total Levied',    value: fmt(overall.total_levied),     color:'#2979FF', bg:'#EEF3FF', bd:'#BFDBFE' },
      { label:'Total Collected', value: fmt(overall.total_collected),   color:'#059669', bg:'#E6FBF4', bd:'#A7F3D0' },
      { label:'Outstanding',     value: fmt(overall.total_outstanding), color:'#E53E3E', bg:'#FEF2F2', bd:'#FECACA' },
      { label:'Collection Rate', value: pct(overall.collection_rate),   color:'#7C3AED', bg:'#F5F3FF', bd:'#DDD6FE' },
    ].map(s => `
      <td style="width:25%;padding:4px">
        <div style="background:${s.bg};border:1.5px solid ${s.bd};border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5C6A8A;margin-bottom:6px">${s.label}</div>
          <div style="font-size:16px;font-weight:800;color:${s.color}">${s.value}</div>
        </div>
      </td>`).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F4FF;font-family:Arial,sans-serif">
<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(13,19,38,0.10)">
  <div style="background:#080e1c;padding:28px 32px">
    <table style="width:100%"><tr>
      <td><div style="font-size:22px;font-weight:800;color:#ffffff">VALUGRID</div>
          <div style="font-size:11px;color:#6B8AFF;letter-spacing:2px;text-transform:uppercase;margin-top:2px">Compliance Intelligence Platform</div></td>
      <td style="text-align:right"><div style="background:#1a2540;border-radius:8px;padding:8px 16px">
        <div style="font-size:11px;color:#8A9CC0;text-transform:uppercase;letter-spacing:1px">Weekly Report</div>
        <div style="font-size:12px;color:#ffffff;font-weight:600;margin-top:2px">FY ${fy}</div>
      </div></td>
    </tr></table>
  </div>
  <div style="background:#EEF3FF;padding:10px 32px;border-bottom:1px solid #DDE3F0">
    <span style="font-size:12px;color:#5C6A8A">Generated: ${now}</span>
    <span style="float:right;font-size:12px;color:#2979FF;font-weight:700">WEEKLY COLLECTIONS SUMMARY</span>
  </div>
  <div style="padding:24px 32px 8px">
    <table style="width:100%"><tr>${statCards}</tr></table>
    <table style="width:100%;margin-top:12px"><tr>
      ${[{l:'Total Cases',v:overall.total_cases,c:'#0d1326'},{l:'With Payment',v:overall.cases_with_payment,c:'#059669'},{l:'No Payment',v:overall.cases_no_payment,c:'#E53E3E'}]
        .map(s => `<td style="width:33%;padding:4px"><div style="background:#F5F8FF;border:1px solid #DDE3F0;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5C6A8A;margin-bottom:4px">${s.l}</div>
          <div style="font-size:20px;font-weight:800;color:${s.c}">${s.v || 0}</div></div></td>`).join('')}
    </tr></table>
  </div>
  <div style="padding:20px 32px 8px">
    <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5C6A8A;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #EEF3FF">Arrears by Operational Area</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#080e1c">
        ${['Area','Parish','Cases','Collected','Outstanding','Rate'].map(h =>
          `<th style="padding:8px 12px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8A9CC0;text-align:left">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${areaRows}</tbody>
    </table>
  </div>
  <div style="padding:12px 32px 8px">
    <table style="width:100%"><tr>
      <td style="width:50%;padding-right:8px;vertical-align:top">
        <div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:10px;padding:16px">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#E53E3E;margin-bottom:10px">Summons Status</div>
          <table style="width:100%;border-collapse:collapse">${summonsRows || '<tr><td style="color:#5C6A8A;font-size:13px;padding:6px">No summons</td></tr>'}</table>
        </div>
      </td>
      <td style="width:50%;padding-left:8px;vertical-align:top">
        <div style="background:#F5F3FF;border:1.5px solid #DDD6FE;border-radius:10px;padding:16px">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7C3AED;margin-bottom:10px">Payment Plans</div>
          ${(plans || []).map((p: any) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #EDE9FE">
            <span style="font-size:13px;color:#0d1326">${p.status}</span>
            <span style="font-size:13px;font-weight:700;color:#7C3AED">${p.count}</span></div>`).join('')}
          ${plans.length === 0 ? '<p style="color:#5C6A8A;font-size:13px;margin:0">No payment plans</p>' : ''}
        </div>
      </td>
    </tr></table>
  </div>
  ${Number(bottleneck?.unvisited || 0) > 0 ? `
  <div style="margin:12px 32px;background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;padding:14px 16px">
    <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#D97706;margin-bottom:6px">Operational Alert</div>
    <div style="font-size:13px;color:#0d1326"><strong>${bottleneck.unvisited}</strong> cases have never been visited —
    <strong style="color:#E53E3E">J$${Number(bottleneck.unvisited_outstanding||0).toLocaleString()}</strong> outstanding. Immediate deployment recommended.</div>
  </div>` : ''}
  <div style="background:#080e1c;padding:20px 32px;margin-top:16px">
    <div style="font-size:11px;color:#8A9CC0;text-align:center">
      Automatically generated by ValuGrid — Compliance Intelligence Platform<br>
      <span style="color:#6B8AFF">civictrace-web.vercel.app</span> &nbsp;·&nbsp; Confidential — Internal Use Only
    </div>
  </div>
</div>
</body></html>`;
  }

  async sendWeeklyReport(recipients: string[]): Promise<void> {
    const data = await this.getCollectionsSummary();
    const html = this.buildEmailHtml(data);
    const now = new Date().toLocaleDateString('en-JM', { day:'numeric', month:'long', year:'numeric' });
    const collected = data.overall.total_collected ? `J$${Number(data.overall.total_collected).toLocaleString()}` : 'J$0';
    const rate = data.overall.collection_rate ? `${Number(data.overall.collection_rate).toFixed(2)}%` : '0.00%';

    const { error } = await this.getResend().emails.send({
      from: 'ValuGrid Reports <reports@valugrid.gov.jm>',
      to: recipients,
      subject: `ValuGrid Weekly Collections — ${now} | ${collected} collected | ${rate} rate`,
      html,
    });

    if (error) {
      this.logger.error('Resend error:', error);
      throw new Error(JSON.stringify(error));
    }
    this.logger.log(`Weekly report sent to ${recipients.join(', ')}`);
  }

  async sendTestReport(recipient: string): Promise<{ message: string }> {
    await this.sendWeeklyReport([recipient]);
    return { message: `Test report sent to ${recipient}` };
  }
}
