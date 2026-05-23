import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ── 1. DAILY OFFICER REPORT ──────────────────────────────────────
  async getDailyOfficerReport(officerId: string, date: string) {
    const deliveries = await this.db.query(
      `SELECT nd.id, nd.status, nd.notes, nd.delivered_at,
              nd.gps_lat, nd.gps_lng, nd.recipient_name,
              pc.composite_key, pc.owner_name_search as owner_name,
              pc.property_address, pc.area_code
       FROM delivery.notice_delivery nd
       JOIN registry.property_case pc ON pc.id = nd.property_case_id
       WHERE nd.officer_id = $1
         AND DATE(nd.delivered_at) = $2::date
       ORDER BY nd.delivered_at ASC`,
      [officerId, date],
    );

    const summary = {
      delivered: deliveries.filter((d: any) => d.status === 'DELIVERED').length,
      owner_absent: deliveries.filter((d: any) => d.status === 'OWNER_ABSENT').length,
      refused: deliveries.filter((d: any) => d.status === 'REFUSED').length,
      vacant: deliveries.filter((d: any) => d.status === 'VACANT').length,
      other: deliveries.filter((d: any) => !['DELIVERED','OWNER_ABSENT','REFUSED','VACANT'].includes(d.status)).length,
      total: deliveries.length,
    };

    const officer = await this.db.query(
      `SELECT u.full_name, u.email, u.region, r.name as role_name
       FROM identity.user u JOIN identity.role r ON r.id = u.role_id
       WHERE u.id = $1`,
      [officerId],
    );

    return { officer: officer[0], date, summary, deliveries };
  }

  // ── 2. DELIVERY COMPLETION REPORT ────────────────────────────────
  async getDeliveryCompletionReport(areaId: string, dateFrom: string, dateTo: string) {
    const data = await this.db.query(
      `SELECT
         a.name as area_name, a.parish,
         COUNT(*) as total_deliveries,
         COUNT(*) FILTER (WHERE nd.status = 'DELIVERED') as delivered,
         COUNT(*) FILTER (WHERE nd.status = 'OWNER_ABSENT') as owner_absent,
         COUNT(*) FILTER (WHERE nd.status = 'REFUSED') as refused,
         COUNT(*) FILTER (WHERE nd.status = 'VACANT') as vacant,
         COUNT(*) FILTER (WHERE nd.status = 'INCORRECT_ADDRESS') as incorrect_address,
         COUNT(*) FILTER (WHERE nd.status = 'ACCESS_DENIED') as access_denied,
         COUNT(*) FILTER (WHERE nd.status = 'DEMOLISHED') as demolished,
         ROUND(COUNT(*) FILTER (WHERE nd.status = 'DELIVERED') * 100.0 / NULLIF(COUNT(*),0), 2) as delivery_rate
       FROM delivery.notice_delivery nd
       JOIN delivery.officer_assignment oa ON oa.id = nd.assignment_id
       JOIN gis.area a ON a.id = oa.area_id
       WHERE ($1::uuid IS NULL OR oa.area_id = $1::uuid)
         AND nd.delivered_at BETWEEN $2::date AND $3::date + interval '1 day'
       GROUP BY a.name, a.parish
       ORDER BY delivery_rate DESC`,
      [areaId || null, dateFrom, dateTo],
    );

    const byOfficer = await this.db.query(
      `SELECT
         u.full_name as officer_name,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE nd.status = 'DELIVERED') as delivered,
         ROUND(COUNT(*) FILTER (WHERE nd.status = 'DELIVERED') * 100.0 / NULLIF(COUNT(*),0), 2) as rate
       FROM delivery.notice_delivery nd
       JOIN identity.user u ON u.id = nd.officer_id
       JOIN delivery.officer_assignment oa ON oa.id = nd.assignment_id
       WHERE ($1::uuid IS NULL OR oa.area_id = $1::uuid)
         AND nd.delivered_at BETWEEN $2::date AND $3::date + interval '1 day'
       GROUP BY u.full_name
       ORDER BY delivered DESC`,
      [areaId || null, dateFrom, dateTo],
    );

    return { byArea: data, byOfficer, dateFrom, dateTo };
  }

  // ── 3. OUTSTANDING BALANCE REPORT ────────────────────────────────
  async getOutstandingBalanceReport(parish?: string) {
    const data = await this.db.query(
      `SELECT
         a.name as area_name, a.parish, a.region,
         COUNT(DISTINCT pc.id) as total_cases,
         COUNT(DISTINCT pc.id) FILTER (WHERE ccs.status = 'DELINQUENT') as delinquent_cases,
         SUM(ccs.total_outstanding) as total_outstanding,
         AVG(ccs.total_outstanding) as avg_outstanding,
         MAX(ccs.total_outstanding) as max_outstanding,
         SUM(ccs.years_outstanding) as total_years,
         AVG(ccs.years_outstanding) as avg_years
       FROM registry.property_case pc
       JOIN gis.area a ON a.id = pc.area_id
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE pc.deleted_at IS NULL
         AND ($1::text IS NULL OR a.parish = $1)
       GROUP BY a.name, a.parish, a.region
       ORDER BY total_outstanding DESC NULLS LAST`,
      [parish || null],
    );

    const totals = await this.db.query(
      `SELECT
         COUNT(DISTINCT pc.id) as total_cases,
         SUM(ccs.total_outstanding) as grand_total,
         COUNT(DISTINCT pc.id) FILTER (WHERE ccs.status = 'DELINQUENT') as delinquent_count
       FROM registry.property_case pc
       LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
       WHERE pc.deleted_at IS NULL`,
    );

    return { byArea: data, totals: totals[0], parish };
  }

  // ── 4. PAYMENT CONVERSION REPORT ─────────────────────────────────
  async getPaymentConversionReport(dateFrom: string, dateTo: string) {
    const batches = await this.db.query(
      `SELECT
         b.batch_reference, b.report_period_start, b.report_period_end,
         b.total_records, b.matched_count, b.unmatched_count,
         b.total_amount, b.status, b.created_at,
         u.full_name as submitted_by,
         ROUND(b.matched_count * 100.0 / NULLIF(b.total_records, 0), 2) as match_rate
       FROM reconciliation.reconciliation_batch b
       JOIN identity.user u ON u.id = b.submitted_by
       WHERE b.created_at BETWEEN $1::date AND $2::date + interval '1 day'
       ORDER BY b.created_at DESC`,
      [dateFrom, dateTo],
    );

    const summary = await this.db.query(
      `SELECT
         SUM(total_records) as total_records,
         SUM(matched_count) as total_matched,
         SUM(unmatched_count) as total_unmatched,
         SUM(total_amount) as total_amount,
         ROUND(SUM(matched_count) * 100.0 / NULLIF(SUM(total_records), 0), 2) as overall_match_rate
       FROM reconciliation.reconciliation_batch
       WHERE created_at BETWEEN $1::date AND $2::date + interval '1 day'`,
      [dateFrom, dateTo],
    );

    return { batches, summary: summary[0], dateFrom, dateTo };
  }

  // ── 5. EXECUTIVE DASHBOARD REPORT ────────────────────────────────
  async getExecutiveDashboard() {
    const [cases, deliveries, reconciliation, topAreas] = await Promise.all([
      this.db.query(
        `SELECT
           COUNT(*) as total_cases,
           COUNT(*) FILTER (WHERE ccs.status = 'DELINQUENT') as delinquent,
           SUM(ccs.total_outstanding) as total_outstanding,
           AVG(ccs.total_outstanding) as avg_outstanding
         FROM registry.property_case pc
         LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
         WHERE pc.deleted_at IS NULL`,
      ),
      this.db.query(
        `SELECT
           COUNT(*) as total_deliveries,
           COUNT(*) FILTER (WHERE status = 'DELIVERED') as delivered,
           COUNT(*) FILTER (WHERE status = 'OWNER_ABSENT') as owner_absent,
           COUNT(*) FILTER (WHERE status = 'REFUSED') as refused,
           ROUND(COUNT(*) FILTER (WHERE status = 'DELIVERED') * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
           COUNT(*) FILTER (WHERE delivered_at >= NOW() - INTERVAL '30 days') as last_30_days
         FROM delivery.notice_delivery`,
      ),
      this.db.query(
        `SELECT
           COUNT(*) as total_batches,
           SUM(total_amount) as total_reconciled,
           ROUND(AVG(matched_count * 100.0 / NULLIF(total_records, 0)), 2) as avg_match_rate
         FROM reconciliation.reconciliation_batch
         WHERE status = 'COMPLETE'`,
      ),
      this.db.query(
        `SELECT a.name, a.parish,
           COUNT(pc.id) as case_count,
           SUM(ccs.total_outstanding) as outstanding
         FROM gis.area a
         LEFT JOIN registry.property_case pc ON pc.area_id = a.id
         LEFT JOIN compliance.case_compliance_status ccs ON ccs.property_case_id = pc.id
         WHERE pc.deleted_at IS NULL
         GROUP BY a.name, a.parish
         ORDER BY outstanding DESC NULLS LAST
         LIMIT 10`,
      ),
    ]);

    return {
      cases: cases[0],
      deliveries: deliveries[0],
      reconciliation: reconciliation[0],
      topAreas,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── PDF EXPORT ────────────────────────────────────────────────────
  async exportOutstandingBalancePDF(res: Response, parish?: string) {
    const report = await this.getOutstandingBalanceReport(parish);
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="outstanding-balance-${Date.now()}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('ValuGrid', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Outstanding Balance Report', { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    if (parish) doc.text(`Parish: ${parish}`, { align: 'center' });
    doc.moveDown(2);

    // Summary box
    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Cases: ${report.totals?.total_cases || 0}`);
    doc.text(`Delinquent Cases: ${report.totals?.delinquent_count || 0}`);
    doc.text(`Grand Total Outstanding: J$${Number(report.totals?.grand_total || 0).toLocaleString()}`);
    doc.moveDown(2);

    // Table header
    doc.fontSize(12).font('Helvetica-Bold').text('Breakdown by Area');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const cols = { area: 50, parish: 200, cases: 310, delinquent: 370, outstanding: 440 };

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Area', cols.area, tableTop);
    doc.text('Parish', cols.parish, tableTop);
    doc.text('Cases', cols.cases, tableTop);
    doc.text('Delinquent', cols.delinquent, tableTop);
    doc.text('Outstanding', cols.outstanding, tableTop);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    doc.fontSize(8).font('Helvetica');
    for (const row of report.byArea) {
      if (doc.y > 700) { doc.addPage(); }
      const y = doc.y;
      doc.text(row.area_name || '', cols.area, y, { width: 140 });
      doc.text(row.parish || '', cols.parish, y, { width: 100 });
      doc.text(String(row.total_cases || 0), cols.cases, y);
      doc.text(String(row.delinquent_cases || 0), cols.delinquent, y);
      doc.text(`J$${Number(row.total_outstanding || 0).toLocaleString()}`, cols.outstanding, y);
      doc.moveDown(0.8);
    }

    doc.end();
  }

  // ── EXCEL EXPORT ──────────────────────────────────────────────────
  async exportOutstandingBalanceExcel(res: Response, parish?: string) {
    const report = await this.getOutstandingBalanceReport(parish);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ValuGrid';

    const sheet = workbook.addWorksheet('Outstanding Balances');

    // Title
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = 'ValuGrid — Outstanding Balance Report';
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    // Summary
    sheet.addRow([]);
    sheet.addRow(['Summary']);
    sheet.addRow(['Total Cases', report.totals?.total_cases || 0]);
    sheet.addRow(['Delinquent Cases', report.totals?.delinquent_count || 0]);
    sheet.addRow(['Grand Total Outstanding', `J$${Number(report.totals?.grand_total || 0).toLocaleString()}`]);
    sheet.addRow([]);

    // Headers
    const headerRow = sheet.addRow(['Area', 'Parish', 'Region', 'Total Cases', 'Delinquent', 'Total Outstanding', 'Avg Outstanding', 'Max Outstanding']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Column widths
    sheet.columns = [
      { width: 25 }, { width: 20 }, { width: 15 },
      { width: 12 }, { width: 12 }, { width: 20 },
      { width: 20 }, { width: 20 },
    ];

    // Data rows
    for (const row of report.byArea) {
      const dataRow = sheet.addRow([
        row.area_name, row.parish, row.region,
        Number(row.total_cases || 0),
        Number(row.delinquent_cases || 0),
        Number(row.total_outstanding || 0),
        Number(row.avg_outstanding || 0),
        Number(row.max_outstanding || 0),
      ]);

      if (Number(row.delinquent_cases) > 0) {
        dataRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
    }

    // Payment conversion sheet
    const reconSheet = workbook.addWorksheet('Payment Conversion');
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const convReport = await this.getPaymentConversionReport(monthStart, today);

    reconSheet.addRow(['ValuGrid — Payment Conversion Report']).font = { bold: true, size: 14 };
    reconSheet.addRow([`Period: ${monthStart} to ${today}`]);
    reconSheet.addRow([]);
    reconSheet.addRow(['Total Records', convReport.summary?.total_records || 0]);
    reconSheet.addRow(['Total Matched', convReport.summary?.total_matched || 0]);
    reconSheet.addRow(['Total Amount', `J$${Number(convReport.summary?.total_amount || 0).toLocaleString()}`]);
    reconSheet.addRow(['Match Rate', `${convReport.summary?.overall_match_rate || 0}%`]);
    reconSheet.addRow([]);

    const rHeaderRow = reconSheet.addRow(['Batch Reference', 'Period Start', 'Period End', 'Records', 'Matched', 'Unmatched', 'Amount', 'Match Rate', 'Submitted By']);
    rHeaderRow.font = { bold: true };
    rHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    rHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const b of convReport.batches) {
      reconSheet.addRow([
        b.batch_reference, b.report_period_start, b.report_period_end,
        Number(b.total_records), Number(b.matched_count), Number(b.unmatched_count),
        Number(b.total_amount || 0), `${b.match_rate || 0}%`, b.submitted_by,
      ]);
    }

    reconSheet.columns = [{ width: 30 }, { width: 15 }, { width: 15 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 18 }, { width: 12 }, { width: 25 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-report-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ── SUMMONS REPORT ────────────────────────────────────────────────
  async getSummonsData(financialYear?: string) {
    const fy = financialYear || '2024-2025';
    const rows = await this.db.query(`
      SELECT s.summons_number, s.financial_year, s.issued_date, s.court_date,
             s.status, s.previous_summons_count, s.notes,
             pc.owner_name, pc.property_address, pc.composite_key,
             a.name as area_name, a.parish
      FROM registry.summons s
      JOIN registry.property_case pc ON pc.id = s.property_case_id
      JOIN gis.area a ON a.id = pc.area_id
      WHERE s.financial_year = $1 AND pc.deleted_at IS NULL
      ORDER BY s.issued_date DESC`, [fy]);
    const totals = await this.db.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'SERVED') as served,
             COUNT(*) FILTER (WHERE status = 'ADJUDICATED') as adjudicated,
             COUNT(*) FILTER (WHERE status = 'COURT_PENDING') as court_pending,
             COUNT(*) FILTER (WHERE status = 'ISSUED') as issued
      FROM registry.summons s
      JOIN registry.property_case pc ON pc.id = s.property_case_id
      WHERE s.financial_year = $1 AND pc.deleted_at IS NULL`, [fy]);
    return { rows, totals: totals[0], financialYear: fy };
  }

  async exportSummonsPDF(res: Response, financialYear?: string) {
    const data = await this.getSummonsData(financialYear);
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-summons-${Date.now()}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).font('Helvetica-Bold').text('ValuGrid', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Summons Report', { align: 'center' });
    doc.fontSize(10).text(`Financial Year: ${data.financialYear}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Summons: ${data.totals?.total || 0}`);
    doc.text(`Issued: ${data.totals?.issued || 0}  |  Served: ${data.totals?.served || 0}  |  Court Pending: ${data.totals?.court_pending || 0}  |  Adjudicated: ${data.totals?.adjudicated || 0}`);
    doc.moveDown(1.5);
    doc.fontSize(11).font('Helvetica-Bold').text('Summons Details');
    doc.moveDown(0.5);
    const cols = { num: 30, owner: 130, address: 270, status: 420, issued: 490, court: 570 };
    const top = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Summons #', cols.num, top); doc.text('Owner', cols.owner, top);
    doc.text('Address', cols.address, top); doc.text('Status', cols.status, top);
    doc.text('Issued', cols.issued, top); doc.text('Court Date', cols.court, top);
    doc.moveDown(0.4); doc.moveTo(30, doc.y).lineTo(760, doc.y).stroke(); doc.moveDown(0.3);
    doc.fontSize(7).font('Helvetica');
    for (const r of data.rows) {
      if (doc.y > 520) { doc.addPage({ layout: 'landscape' }); }
      const y = doc.y;
      doc.text(r.summons_number || '-', cols.num, y, { width: 95 });
      doc.text(r.owner_name || '-', cols.owner, y, { width: 135 });
      doc.text(r.property_address || '-', cols.address, y, { width: 145 });
      doc.text(r.status || '-', cols.status, y, { width: 65 });
      doc.text(r.issued_date ? new Date(r.issued_date).toLocaleDateString() : '-', cols.issued, y, { width: 75 });
      doc.text(r.court_date ? new Date(r.court_date).toLocaleDateString() : '-', cols.court, y, { width: 75 });
      doc.moveDown(0.8);
    }
    doc.end();
  }

  async exportSummonsExcel(res: Response, financialYear?: string) {
    const data = await this.getSummonsData(financialYear);
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'ValuGrid';
    const sheet = workbook.addWorksheet('Summons');
    sheet.mergeCells('A1:J1'); sheet.getCell('A1').value = 'ValuGrid — Summons Report';
    sheet.getCell('A1').font = { bold: true, size: 14 }; sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.mergeCells('A2:J2'); sheet.getCell('A2').value = `Financial Year: ${data.financialYear} | Generated: ${new Date().toLocaleString()}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.addRow([]); sheet.addRow(['Summary']);
    sheet.addRow(['Total', data.totals?.total || 0]);
    sheet.addRow(['Issued', data.totals?.issued || 0]);
    sheet.addRow(['Served', data.totals?.served || 0]);
    sheet.addRow(['Court Pending', data.totals?.court_pending || 0]);
    sheet.addRow(['Adjudicated', data.totals?.adjudicated || 0]);
    sheet.addRow([]);
    const hdr = sheet.addRow(['Summons #','Financial Year','Owner','Property Address','Area','Parish','Status','Issued Date','Court Date','Prior Summons']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    sheet.columns = [{width:18},{width:14},{width:28},{width:35},{width:18},{width:15},{width:16},{width:14},{width:14},{width:14}];
    for (const r of data.rows) {
      sheet.addRow([r.summons_number, r.financial_year, r.owner_name, r.property_address,
        r.area_name, r.parish, r.status,
        r.issued_date ? new Date(r.issued_date).toLocaleDateString() : '',
        r.court_date ? new Date(r.court_date).toLocaleDateString() : '',
        r.previous_summons_count || 0]);
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-summons-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res); res.end();
  }

  // ── DISCRETIONARY RELIEF REPORT ───────────────────────────────────
  async getReliefData(financialYear?: string) {
    const fy = financialYear || '2024-2025';
    const rows = await this.db.query(`
      SELECT dr.application_date, dr.applicant_name, dr.relief_type,
             dr.amount_requested, dr.amount_approved, dr.financial_year,
             dr.status, dr.decision_date, dr.decision_notes,
             pc.composite_key, pc.property_address, a.name as area_name, a.parish
      FROM registry.discretionary_relief dr
      JOIN registry.property_case pc ON pc.id = dr.property_case_id
      JOIN gis.area a ON a.id = pc.area_id
      WHERE dr.financial_year = $1 AND pc.deleted_at IS NULL
      ORDER BY dr.application_date DESC`, [fy]);
    const totals = await this.db.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status='APPROVED') as approved,
             COUNT(*) FILTER (WHERE status='PARTIAL_APPROVAL') as partial,
             COUNT(*) FILTER (WHERE status='PENDING') as pending,
             COUNT(*) FILTER (WHERE status='REJECTED') as rejected,
             COALESCE(SUM(amount_requested),0) as total_requested,
             COALESCE(SUM(amount_approved),0) as total_approved
      FROM registry.discretionary_relief dr
      JOIN registry.property_case pc ON pc.id = dr.property_case_id
      WHERE dr.financial_year = $1 AND pc.deleted_at IS NULL`, [fy]);
    return { rows, totals: totals[0], financialYear: fy };
  }

  async exportReliefPDF(res: Response, financialYear?: string) {
    const data = await this.getReliefData(financialYear);
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-relief-${Date.now()}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).font('Helvetica-Bold').text('ValuGrid', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Discretionary Relief Report', { align: 'center' });
    doc.fontSize(10).text(`Financial Year: ${data.financialYear} | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Summary'); doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Applications: ${data.totals?.total || 0}  |  Approved: ${data.totals?.approved || 0}  |  Partial: ${data.totals?.partial || 0}  |  Pending: ${data.totals?.pending || 0}  |  Rejected: ${data.totals?.rejected || 0}`);
    doc.text(`Total Requested: J$${Number(data.totals?.total_requested || 0).toLocaleString()}  |  Total Approved: J$${Number(data.totals?.total_approved || 0).toLocaleString()}`);
    doc.moveDown(1.5);
    const cols = { applicant: 30, property: 180, type: 330, requested: 420, approved: 500, status: 580 };
    const top = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Applicant', cols.applicant, top); doc.text('Property', cols.property, top);
    doc.text('Relief Type', cols.type, top); doc.text('Requested', cols.requested, top);
    doc.text('Approved', cols.approved, top); doc.text('Status', cols.status, top);
    doc.moveDown(0.4); doc.moveTo(30, doc.y).lineTo(760, doc.y).stroke(); doc.moveDown(0.3);
    doc.fontSize(7).font('Helvetica');
    for (const r of data.rows) {
      if (doc.y > 520) { doc.addPage({ layout: 'landscape' }); }
      const y = doc.y;
      doc.text(r.applicant_name || '-', cols.applicant, y, { width: 145 });
      doc.text(r.property_address || '-', cols.property, y, { width: 145 });
      doc.text(r.relief_type || '-', cols.type, y, { width: 85 });
      doc.text(`J$${Number(r.amount_requested || 0).toLocaleString()}`, cols.requested, y, { width: 75 });
      doc.text(r.amount_approved ? `J$${Number(r.amount_approved).toLocaleString()}` : '-', cols.approved, y, { width: 75 });
      doc.text(r.status || '-', cols.status, y, { width: 80 });
      doc.moveDown(0.8);
    }
    doc.end();
  }

  async exportReliefExcel(res: Response, financialYear?: string) {
    const data = await this.getReliefData(financialYear);
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'ValuGrid';
    const sheet = workbook.addWorksheet('Discretionary Relief');
    sheet.mergeCells('A1:I1'); sheet.getCell('A1').value = 'ValuGrid — Discretionary Relief Report';
    sheet.getCell('A1').font = { bold: true, size: 14 }; sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.mergeCells('A2:I2'); sheet.getCell('A2').value = `Financial Year: ${data.financialYear} | Generated: ${new Date().toLocaleString()}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.addRow([]); sheet.addRow(['Summary']);
    sheet.addRow(['Total Applications', data.totals?.total || 0]);
    sheet.addRow(['Approved', data.totals?.approved || 0]);
    sheet.addRow(['Partial Approval', data.totals?.partial || 0]);
    sheet.addRow(['Pending', data.totals?.pending || 0]);
    sheet.addRow(['Rejected', data.totals?.rejected || 0]);
    sheet.addRow(['Total Requested', `J$${Number(data.totals?.total_requested || 0).toLocaleString()}`]);
    sheet.addRow(['Total Approved', `J$${Number(data.totals?.total_approved || 0).toLocaleString()}`]);
    sheet.addRow([]);
    const hdr = sheet.addRow(['Applicant','Property Address','Area','Parish','Relief Type','Amount Requested','Amount Approved','Status','Decision Date']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    sheet.columns = [{width:28},{width:35},{width:18},{width:15},{width:22},{width:18},{width:18},{width:18},{width:15}];
    for (const r of data.rows) {
      const row = sheet.addRow([r.applicant_name, r.property_address, r.area_name, r.parish,
        r.relief_type, Number(r.amount_requested || 0), Number(r.amount_approved || 0),
        r.status, r.decision_date ? new Date(r.decision_date).toLocaleDateString() : '']);
      if (r.status === 'APPROVED') row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      if (r.status === 'REJECTED') row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      if (r.status === 'PENDING') row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-relief-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res); res.end();
  }

  // ── OVERALL COLLECTIONS REPORT ────────────────────────────────────
  async getCollectionsData(financialYear?: string) {
    const fy = financialYear || '2024-2025';
    const taxYear = parseInt(fy.split('-')[0]);
    const rows = await this.db.query(`
      SELECT pc.composite_key, pc.owner_name, pc.property_address,
             pc.property_type, a.name as area_name, a.parish,
             tb.amount_due, tb.amount_paid, tb.balance, tb.status
      FROM registry.tax_balance tb
      JOIN registry.property_case pc ON pc.id = tb.property_case_id
      JOIN gis.area a ON a.id = pc.area_id
      WHERE tb.tax_year = $1 AND pc.deleted_at IS NULL
      ORDER BY tb.balance DESC`, [taxYear]);
    const totals = await this.db.query(`
      SELECT COUNT(DISTINCT pc.id) as total_cases,
             SUM(tb.amount_due) as total_levied,
             SUM(tb.amount_paid) as total_collected,
             SUM(tb.balance) as total_outstanding,
             ROUND(SUM(tb.amount_paid)/NULLIF(SUM(tb.amount_due),0)*100,2) as collection_rate,
             COUNT(*) FILTER (WHERE tb.status='PAID') as paid_count,
             COUNT(*) FILTER (WHERE tb.status='OUTSTANDING') as outstanding_count,
             COUNT(*) FILTER (WHERE tb.status='PARTIAL') as partial_count
      FROM registry.tax_balance tb
      JOIN registry.property_case pc ON pc.id = tb.property_case_id
      WHERE tb.tax_year = $1 AND pc.deleted_at IS NULL`, [taxYear]);
    return { rows, totals: totals[0], financialYear: fy, taxYear };
  }

  async exportCollectionsPDF(res: Response, financialYear?: string) {
    const data = await this.getCollectionsData(financialYear);
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-collections-${Date.now()}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).font('Helvetica-Bold').text('ValuGrid', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Overall Collections Report', { align: 'center' });
    doc.fontSize(10).text(`Tax Year: ${data.taxYear} (FY ${data.financialYear}) | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Summary'); doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Cases: ${data.totals?.total_cases || 0}  |  Collection Rate: ${data.totals?.collection_rate || 0}%`);
    doc.text(`Total Levied: J$${Number(data.totals?.total_levied || 0).toLocaleString()}  |  Total Collected: J$${Number(data.totals?.total_collected || 0).toLocaleString()}  |  Outstanding: J$${Number(data.totals?.total_outstanding || 0).toLocaleString()}`);
    doc.text(`Paid: ${data.totals?.paid_count || 0}  |  Partial: ${data.totals?.partial_count || 0}  |  Outstanding: ${data.totals?.outstanding_count || 0}`);
    doc.moveDown(1.5);
    const cols = { key: 30, owner: 130, area: 290, type: 380, due: 450, paid: 530, balance: 610, status: 690 };
    const top = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Val. No.', cols.key, top); doc.text('Owner', cols.owner, top);
    doc.text('Area', cols.area, top); doc.text('Type', cols.type, top);
    doc.text('Amount Due', cols.due, top); doc.text('Paid', cols.paid, top);
    doc.text('Balance', cols.balance, top); doc.text('Status', cols.status, top);
    doc.moveDown(0.4); doc.moveTo(30, doc.y).lineTo(770, doc.y).stroke(); doc.moveDown(0.3);
    doc.fontSize(7).font('Helvetica');
    for (const r of data.rows) {
      if (doc.y > 520) { doc.addPage({ layout: 'landscape' }); }
      const y = doc.y;
      doc.text(r.composite_key || '-', cols.key, y, { width: 95 });
      doc.text(r.owner_name || '-', cols.owner, y, { width: 155 });
      doc.text(r.area_name || '-', cols.area, y, { width: 85 });
      doc.text(r.property_type || '-', cols.type, y, { width: 65 });
      doc.text(`J$${Number(r.amount_due || 0).toLocaleString()}`, cols.due, y, { width: 75 });
      doc.text(`J$${Number(r.amount_paid || 0).toLocaleString()}`, cols.paid, y, { width: 75 });
      doc.text(`J$${Number(r.balance || 0).toLocaleString()}`, cols.balance, y, { width: 75 });
      doc.text(r.status || '-', cols.status, y, { width: 65 });
      doc.moveDown(0.8);
    }
    doc.end();
  }

  async exportCollectionsExcel(res: Response, financialYear?: string) {
    const data = await this.getCollectionsData(financialYear);
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'ValuGrid';
    const sheet = workbook.addWorksheet('Collections');
    sheet.mergeCells('A1:H1'); sheet.getCell('A1').value = 'ValuGrid — Overall Collections Report';
    sheet.getCell('A1').font = { bold: true, size: 14 }; sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.mergeCells('A2:H2'); sheet.getCell('A2').value = `Tax Year: ${data.taxYear} | FY: ${data.financialYear} | Generated: ${new Date().toLocaleString()}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.addRow([]); sheet.addRow(['Summary']);
    sheet.addRow(['Total Cases', data.totals?.total_cases || 0]);
    sheet.addRow(['Total Levied', `J$${Number(data.totals?.total_levied || 0).toLocaleString()}`]);
    sheet.addRow(['Total Collected', `J$${Number(data.totals?.total_collected || 0).toLocaleString()}`]);
    sheet.addRow(['Total Outstanding', `J$${Number(data.totals?.total_outstanding || 0).toLocaleString()}`]);
    sheet.addRow(['Collection Rate', `${data.totals?.collection_rate || 0}%`]);
    sheet.addRow(['Paid', data.totals?.paid_count || 0]);
    sheet.addRow(['Partial', data.totals?.partial_count || 0]);
    sheet.addRow(['Outstanding', data.totals?.outstanding_count || 0]);
    sheet.addRow([]);
    const hdr = sheet.addRow(['Valuation No.','Owner','Property Address','Area','Parish','Property Type','Amount Due','Amount Paid','Balance','Status']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    sheet.columns = [{width:22},{width:28},{width:35},{width:18},{width:15},{width:16},{width:16},{width:16},{width:16},{width:14}];
    for (const r of data.rows) {
      const row = sheet.addRow([r.composite_key, r.owner_name, r.property_address,
        r.area_name, r.parish, r.property_type,
        Number(r.amount_due || 0), Number(r.amount_paid || 0), Number(r.balance || 0), r.status]);
      if (r.status === 'PAID') row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      if (r.status === 'OUTSTANDING') row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      if (r.status === 'PARTIAL') row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-collections-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res); res.end();
  }

  // ── ARREARS REPORT ────────────────────────────────────────────────
  async getArrearsCasesData(financialYear?: string, parish?: string) {
    const fy = financialYear || '2024-2025';
    const taxYear = parseInt(fy.split('-')[0]);
    let whereClause = 'WHERE tb.tax_year = $1 AND pc.deleted_at IS NULL AND tb.balance > 0';
    const params: any[] = [taxYear];
    if (parish) { whereClause += ` AND a.parish = $2`; params.push(parish); }
    const rows = await this.db.query(`
      SELECT pc.composite_key, pc.owner_name, pc.property_address,
             pc.property_type, a.name as area_name, a.parish,
             tb.amount_due, tb.amount_paid, tb.balance, tb.status,
             tb.tax_year,
             (SELECT COUNT(*) FROM registry.summons s WHERE s.property_case_id = pc.id) as summons_count,
             (SELECT COUNT(*) FROM registry.payment_plan pp WHERE pp.property_case_id = pc.id AND pp.status = 'ACTIVE') as active_plans
      FROM registry.tax_balance tb
      JOIN registry.property_case pc ON pc.id = tb.property_case_id
      JOIN gis.area a ON a.id = pc.area_id
      ${whereClause}
      ORDER BY tb.balance DESC`, params);
    const totals = await this.db.query(`
      SELECT COUNT(DISTINCT pc.id) as total_cases,
             SUM(tb.balance) as total_arrears,
             AVG(tb.balance) as avg_arrears,
             MAX(tb.balance) as max_arrears,
             COUNT(*) FILTER (WHERE tb.status='OUTSTANDING') as fully_outstanding,
             COUNT(*) FILTER (WHERE tb.status='PARTIAL') as partially_paid
      FROM registry.tax_balance tb
      JOIN registry.property_case pc ON pc.id = tb.property_case_id
      JOIN gis.area a ON a.id = pc.area_id
      ${whereClause}`, params);
    return { rows, totals: totals[0], financialYear: fy, taxYear, parish };
  }

  async exportArrearsPDF(res: Response, financialYear?: string, parish?: string) {
    const data = await this.getArrearsCasesData(financialYear, parish);
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-arrears-${Date.now()}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).font('Helvetica-Bold').text('ValuGrid', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Arrears Report', { align: 'center' });
    doc.fontSize(10).text(`Tax Year: ${data.taxYear}${data.parish ? ' | Parish: ' + data.parish : ''} | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Summary'); doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Cases in Arrears: ${data.totals?.total_cases || 0}`);
    doc.text(`Total Arrears: J$${Number(data.totals?.total_arrears || 0).toLocaleString()}  |  Avg: J$${Number(data.totals?.avg_arrears || 0).toLocaleString()}  |  Max: J$${Number(data.totals?.max_arrears || 0).toLocaleString()}`);
    doc.text(`Fully Outstanding: ${data.totals?.fully_outstanding || 0}  |  Partially Paid: ${data.totals?.partially_paid || 0}`);
    doc.moveDown(1.5);
    const cols = { key: 30, owner: 130, area: 290, due: 370, paid: 445, balance: 520, status: 600, summons: 665 };
    const top = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Val. No.', cols.key, top); doc.text('Owner', cols.owner, top);
    doc.text('Area', cols.area, top); doc.text('Amount Due', cols.due, top);
    doc.text('Paid', cols.paid, top); doc.text('Balance', cols.balance, top);
    doc.text('Status', cols.status, top); doc.text('Summons', cols.summons, top);
    doc.moveDown(0.4); doc.moveTo(30, doc.y).lineTo(760, doc.y).stroke(); doc.moveDown(0.3);
    doc.fontSize(7).font('Helvetica');
    for (const r of data.rows) {
      if (doc.y > 520) { doc.addPage({ layout: 'landscape' }); }
      const y = doc.y;
      doc.text(r.composite_key || '-', cols.key, y, { width: 95 });
      doc.text(r.owner_name || '-', cols.owner, y, { width: 155 });
      doc.text(r.area_name || '-', cols.area, y, { width: 75 });
      doc.text(`J$${Number(r.amount_due || 0).toLocaleString()}`, cols.due, y, { width: 70 });
      doc.text(`J$${Number(r.amount_paid || 0).toLocaleString()}`, cols.paid, y, { width: 70 });
      doc.text(`J$${Number(r.balance || 0).toLocaleString()}`, cols.balance, y, { width: 75 });
      doc.text(r.status || '-', cols.status, y, { width: 60 });
      doc.text(String(r.summons_count || 0), cols.summons, y, { width: 40 });
      doc.moveDown(0.8);
    }
    doc.end();
  }

  async exportArrearsExcel(res: Response, financialYear?: string, parish?: string) {
    const data = await this.getArrearsCasesData(financialYear, parish);
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'ValuGrid';
    const sheet = workbook.addWorksheet('Arrears');
    sheet.mergeCells('A1:I1'); sheet.getCell('A1').value = 'ValuGrid — Arrears Report';
    sheet.getCell('A1').font = { bold: true, size: 14 }; sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.mergeCells('A2:I2'); sheet.getCell('A2').value = `Tax Year: ${data.taxYear}${data.parish ? ' | Parish: ' + data.parish : ''} | Generated: ${new Date().toLocaleString()}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.addRow([]); sheet.addRow(['Summary']);
    sheet.addRow(['Total Cases in Arrears', data.totals?.total_cases || 0]);
    sheet.addRow(['Total Arrears', `J$${Number(data.totals?.total_arrears || 0).toLocaleString()}`]);
    sheet.addRow(['Average Arrears', `J$${Number(data.totals?.avg_arrears || 0).toLocaleString()}`]);
    sheet.addRow(['Max Arrears', `J$${Number(data.totals?.max_arrears || 0).toLocaleString()}`]);
    sheet.addRow(['Fully Outstanding', data.totals?.fully_outstanding || 0]);
    sheet.addRow(['Partially Paid', data.totals?.partially_paid || 0]);
    sheet.addRow([]);
    const hdr = sheet.addRow(['Valuation No.','Owner','Property Address','Area','Parish','Property Type','Amount Due','Amount Paid','Balance','Status','Summons Count','Active Plans']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    sheet.columns = [{width:22},{width:28},{width:35},{width:18},{width:15},{width:16},{width:16},{width:16},{width:16},{width:14},{width:14},{width:14}];
    for (const r of data.rows) {
      const row = sheet.addRow([r.composite_key, r.owner_name, r.property_address,
        r.area_name, r.parish, r.property_type,
        Number(r.amount_due || 0), Number(r.amount_paid || 0), Number(r.balance || 0),
        r.status, Number(r.summons_count || 0), Number(r.active_plans || 0)]);
      if (r.status === 'OUTSTANDING') row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      if (r.status === 'PARTIAL') row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="valugrid-arrears-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res); res.end();
  }

}