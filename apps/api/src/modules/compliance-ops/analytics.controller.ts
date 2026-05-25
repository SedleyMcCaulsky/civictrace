import { Request, Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('arrears')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Arrears report' })
  async arrears(@Query('parish') p?: string, @Query('region') r?: string, @Query('financialYear') fy?: string, @Request() req: any) {
    return this.service.getArrearsReport({ parish: p, region: r, financialYear: fy }, req.user.organisationId);
  }

  @Get('collections')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Collections by period' })
  @ApiQuery({ name: 'period', enum: ['daily','weekly','monthly','quarterly','yearly'] })
  async collections(@Query('period') period: any = 'monthly', @Query('from') from: string, @Query('to') to: string, @Query('parish') parish?: string, @Request() req: any) {
    const toDate = to || new Date().toISOString().split('T')[0];
    const fromDate = from || new Date(new Date().setFullYear(new Date().getFullYear()-1)).toISOString().split('T')[0];
    return this.service.getCollectionsReport(period, fromDate, toDate, parish, req.user.organisationId);
  }

  @Get('collections/overall')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Overall collections summary' })
  async overall(@Query('financialYear') fy?: string, @Request() req: any) { return this.service.getOverallCollections(fy, req.user.organisationId); }

  @Get('delinquency')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Full delinquency report' })
  async delinquency(@Query('parish') p?: string, @Query('minYears') my?: number, @Query('minAmount') ma?: number, @Request() req: any) {
    return this.service.getDelinquencyReport({ parish: p, minYears: my, minAmount: ma }, req.user.organisationId);
  }

  @Get('forecast')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Revenue forecast' })
  async forecast(@Query('months') m: number = 6, @Request() req: any) { return this.service.getForecast(Number(m), req.user.organisationId); }

  @Get('bottlenecks')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Bottleneck analysis' })
  async bottlenecks(@Request() req: any) { return this.service.getBottleneckAnalysis(req.user.organisationId); }
}
