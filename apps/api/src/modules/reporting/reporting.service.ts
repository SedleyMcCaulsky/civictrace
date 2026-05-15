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
    res.setHeader('Content-Disposition', `attachment; filename="civictrace-report-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
