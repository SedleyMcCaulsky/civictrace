import {
  Controller, Get, Post, Body, Query, Param, Res, ParseUUIDPipe, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportingService } from './reporting.service';
import { EmailService } from './email.service';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportingController {
  constructor(private readonly service: ReportingService, private readonly emailService: EmailService) {}

  @Get('executive')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Executive dashboard report' })
  async getExecutive() {
    return this.service.getExecutiveDashboard();
  }

  @Get('officer/:officerId/daily')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Daily officer delivery report' })
  @ApiQuery({ name: 'date', example: '2026-05-08' })
  async getDailyOfficer(
    @Param('officerId', ParseUUIDPipe) officerId: string,
    @Query('date') date: string,
  ) {
    return this.service.getDailyOfficerReport(officerId, date || new Date().toISOString().split('T')[0]);
  }

  @Get('delivery/completion')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Delivery completion report by area' })
  @ApiQuery({ name: 'areaId', required: false })
  @ApiQuery({ name: 'from', example: '2026-01-01' })
  @ApiQuery({ name: 'to', example: '2026-05-08' })
  async getDeliveryCompletion(
    @Query('areaId') areaId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.service.getDeliveryCompletionReport(areaId, from || '2024-01-01', to || today);
  }

  @Get('outstanding')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Outstanding balance report by area' })
  @ApiQuery({ name: 'parish', required: false })
  async getOutstanding(@Req() req: any, @Query('parish') parish?: string) {
    return this.service.getOutstandingBalanceReport(parish);
  }

  @Get('payment-conversion')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Payment conversion/reconciliation report' })
  @ApiQuery({ name: 'from', example: '2026-01-01' })
  @ApiQuery({ name: 'to', example: '2026-05-08' })
  async getPaymentConversion(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.service.getPaymentConversionReport(from || '2024-01-01', to || today);
  }

  @Get('outstanding/export/pdf')
  @RequirePermissions('reports:generate')
  @ApiOperation({ summary: 'Export outstanding balance report as PDF' })
  @ApiQuery({ name: 'parish', required: false })
  async exportPDF(@Query('parish') parish: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportOutstandingBalancePDF(res, parish, req.user.organisationId);
  }

  @Get('outstanding/export/excel')
  @RequirePermissions('reports:generate')
  @ApiOperation({ summary: 'Export outstanding balance + payment conversion as Excel' })
  @ApiQuery({ name: 'parish', required: false })
  async exportExcel(@Query('parish') parish: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportOutstandingBalanceExcel(res, parish, req.user.organisationId);
  }

  @Post('email/test')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Send test weekly report email' })
  async sendTestEmail(@Body('email') email: string) {
    return this.emailService.sendTestReport(email || 'sedley@civictrace.gov.jm');
  }

  @Post('email/weekly')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Trigger weekly report immediately' })
  async sendWeeklyNow(@Body('recipients') recipients: string[]) {
    await this.emailService.sendWeeklyReport(
      recipients?.length ? recipients : ['sedley@civictrace.gov.jm']
    );
    return { message: 'Weekly report sent' };
  }

  @Get('summons/export/pdf')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Export summons report as PDF' })
  @ApiQuery({ name: 'financialYear', required: false })
  async exportSummonsPDF(@Query('financialYear') financialYear: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportSummonsPDF(res, financialYear, req.user.organisationId);
  }

  @Get('summons/export/excel')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Export summons report as Excel' })
  @ApiQuery({ name: 'financialYear', required: false })
  async exportSummonsExcel(@Query('financialYear') financialYear: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportSummonsExcel(res, financialYear, req.user.organisationId);
  }

  @Get('relief/export/pdf')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Export discretionary relief report as PDF' })
  @ApiQuery({ name: 'financialYear', required: false })
  async exportReliefPDF(@Query('financialYear') financialYear: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportReliefPDF(res, financialYear, req.user.organisationId);
  }

  @Get('relief/export/excel')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Export discretionary relief report as Excel' })
  @ApiQuery({ name: 'financialYear', required: false })
  async exportReliefExcel(@Query('financialYear') financialYear: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportReliefExcel(res, financialYear, req.user.organisationId);
  }

  @Get('collections/export/pdf')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Export overall collections report as PDF' })
  @ApiQuery({ name: 'financialYear', required: false })
  async exportCollectionsPDF(@Query('financialYear') financialYear: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportCollectionsPDF(res, financialYear, req.user.organisationId);
  }

  @Get('collections/export/excel')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Export overall collections report as Excel' })
  @ApiQuery({ name: 'financialYear', required: false })
  async exportCollectionsExcel(@Query('financialYear') financialYear: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportCollectionsExcel(res, financialYear, req.user.organisationId);
  }

  @Get('arrears/export/pdf')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Export arrears report as PDF' })
  @ApiQuery({ name: 'financialYear', required: false })
  @ApiQuery({ name: 'parish', required: false })
  async exportArrearsPDF(@Query('financialYear') financialYear: string, @Query('parish') parish: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportArrearsPDF(res, financialYear, parish, req.user.organisationId);
  }

  @Get('arrears/export/excel')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Export arrears report as Excel' })
  @ApiQuery({ name: 'financialYear', required: false })
  @ApiQuery({ name: 'parish', required: false })
  async exportArrearsExcel(@Query('financialYear') financialYear: string, @Query('parish') parish: string, @Res() res: Response, @Req() req: any) {
    return this.service.exportArrearsExcel(res, financialYear, parish, req.user.organisationId);
  }

}