import { Request as NestRequest, Controller, Get, Query } from '@nestjs/common';
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
  async arrears(@NestRequest() req: any, @Query('parish') p?: string, @Query('region') r?: string, @Query('financialYear') fy?: string) {
    return this.service.getArrearsReport({ parish: p, region: r, financialYear: fy }, req.user.organisationId);
  }

  @Get('collections')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Collections by period' })
  @ApiQuery({ name: 'period', enum: ['daily','weekly','monthly','quarterly','yearly'] })
  async collections(@NestRequest() req: any, @Query('period') period: any = 'monthly', @Query('from') from: string, @Query('to') to: string, @Query('parish') parish?: string) {
    const toDate = to || new Date().toISOString().split('T')[0];
    const fromDate = from || new Date(new Date().setFullYear(new Date().getFullYear()-1)).toISOString().split('T')[0];
    return this.service.getCollectionsReport(period, fromDate, toDate, parish, req.user.organisationId);
  }

  @Get('collections/overall')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Overall collections summary' })
  async overall(@NestRequest() req: any, @Query('financialYear') fy?: string) { return this.service.getOverallCollections(fy, req.user.organisationId); }

  @Get('delinquency')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Full delinquency report' })
  async delinquency(@NestRequest() req: any, @Query('parish') p?: string, @Query('minYears') my?: number, @Query('minAmount') ma?: number) {
    return this.service.getDelinquencyReport({ parish: p, minYears: my, minAmount: ma }, req.user.organisationId);
  }

  @Get('forecast')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Revenue forecast' })
  async forecast(@NestRequest() req: any, @Query('months') m: number = 6) { return this.service.getForecast(Number(m), req.user.organisationId); }

  @Get('bottlenecks')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Bottleneck analysis' })
  async bottlenecks(@NestRequest() req: any) { return this.service.getBottleneckAnalysis(req.user.organisationId); }
}
