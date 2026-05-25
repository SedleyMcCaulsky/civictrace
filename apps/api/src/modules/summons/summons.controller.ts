import { Controller, Get, Post, Patch, Body, Param, Query, Request, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SummonsService } from './summons.service';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Summons')
@ApiBearerAuth()
@Controller('summons')
export class SummonsController {
  constructor(private readonly service: SummonsService) {}

  @Get('eligible')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Cases eligible for summons (2+ visits, outstanding balance)' })
  async eligible(@Query('financialYear') fy?: string, @Request() req: any) { return this.service.getEligibleCases(fy, req.user.organisationId); }

  @Get('cases/:id/check')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Check if case is eligible for summons' })
  async check(@Param('id', ParseUUIDPipe) id: string) { return this.service.checkEligibility(id); }

  @Post('cases/:id/issue')
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Issue summons for a case' })
  async issue(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @Request() req: any) {
    return this.service.issueSummons(id, req.user.sub, dto);
  }

  @Get('cases/:id')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get summons for a case' })
  async forCase(@Param('id', ParseUUIDPipe) id: string) { return this.service.getSummonsForCase(id); }

  @Get()
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get all summons' })
  async all(@Query('status') status?: string, @Query('financialYear') fy?: string, @Query('parish') parish?: string, @Request() req: any) {
    return this.service.getAllSummons({ status, financialYear: fy, parish }, req.user.organisationId);
  }

  @Patch(':id/status')
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Update summons status' })
  async updateStatus(@Param('id') id: string, @Body() dto: any) {
    return this.service.updateStatus(id, dto.status, dto.courtDate, dto.notes);
  }
}
