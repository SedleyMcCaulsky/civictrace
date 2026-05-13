import {
  Controller, Get, Post, Body, Query, Param, Res, ParseUUIDPipe,
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
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.service.getDeliveryCompletionReport(areaId, from || '2024-01-01', to || today);
  }

  @Get('outstanding')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Outstanding balance report by area' })
  @ApiQuery({ name: 'parish', required: false })
  async getOutstanding(@Query('parish') parish?: string) {
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
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.service.getPaymentConversionReport(from || '2024-01-01', to || today);
  }

  @Get('outstanding/export/pdf')
  @RequirePermissions('reports:generate')
  @ApiOperation({ summary: 'Export outstanding balance report as PDF' })
  @ApiQuery({ name: 'parish', required: false })
  async exportPDF(@Query('parish') parish: string, @Res() res: Response) {
    return this.service.exportOutstandingBalancePDF(res, parish);
  }

  @Get('outstanding/export/excel')
  @RequirePermissions('reports:generate')
  @ApiOperation({ summary: 'Export outstanding balance + payment conversion as Excel' })
  @ApiQuery({ name: 'parish', required: false })
  async exportExcel(@Query('parish') parish: string, @Res() res: Response) {
    return this.service.exportOutstandingBalanceExcel(res, parish);
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
}
