import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaxDriveService } from './tax-drive.service';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Tax Drives')
@ApiBearerAuth()
@Controller('drives')
export class TaxDriveController {
  constructor(private readonly service: TaxDriveService) {}

  @Post()
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Create a tax drive' })
  async create(@Body() dto: any, @Request() req: any) { return this.service.createDrive(dto, req.user.sub); }

  @Get()
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get all drives' })
  async getDrives(@Query('parish') parish?: string, @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getDrives({ parish, status, from, to });
  }

  @Get('stats')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Overall drive statistics' })
  async getOverallStats(@Query('from') from?: string, @Query('to') to?: string) { return this.service.getOverallStats(from, to); }

  @Get('report')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Drive report by period' })
  async getReport(@Query('period') period: string = 'monthly', @Query('from') from: string, @Query('to') to: string, @Query('parish') parish?: string) {
    const t = to || new Date().toISOString().split('T')[0];
    const f = from || new Date(new Date().setFullYear(new Date().getFullYear()-1)).toISOString().split('T')[0];
    return this.service.getDriveReport(period, f, t, parish);
  }

  @Get(':id')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get drive with all collections' })
  async getById(@Param('id') id: string) { return this.service.getDriveById(id); }

  @Patch(':id')
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Update drive' })
  async update(@Param('id') id: string, @Body() dto: any) { return this.service.updateDrive(id, dto); }
}
