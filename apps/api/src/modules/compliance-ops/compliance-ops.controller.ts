import { Controller, Get, Post, Patch, Body, Param, Query, Request, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComplianceOpsService } from './compliance-ops.service';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Compliance Ops')
@ApiBearerAuth()
@Controller('compliance-ops')
export class ComplianceOpsController {
  constructor(private readonly service: ComplianceOpsService) {}

  @Post('cases/:id/payment-plan')
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Create payment plan' })
  async createPlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @Request() req: any) {
    return this.service.createPaymentPlan(id, dto, req.user.sub);
  }

  @Get('cases/:id/payment-plans')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get payment plans for case' })
  async getPlans(@Param('id', ParseUUIDPipe) id: string) { return this.service.getPaymentPlans(id); }

  @Patch('instalments/:id/payment')
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Record instalment payment' })
  async recordPayment(@Param('id') id: string, @Body() dto: any) {
    return this.service.recordInstalmentPayment(id, dto.amountPaid, dto.receiptNumber);
  }

  @Post('cases/:id/relief')
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Create discretionary relief application' })
  async createRelief(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @Request() req: any) {
    return this.service.createRelief(id, dto, req.user.sub);
  }

  @Get('cases/:id/relief')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get relief applications for case' })
  async getRelief(@Param('id', ParseUUIDPipe) id: string) { return this.service.getReliefApplications(id); }

  @Patch('relief/:id')
  @RequirePermissions('cases:update')
  @ApiOperation({ summary: 'Update relief decision' })
  async updateRelief(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.service.updateRelief(id, dto, req.user.sub);
  }

  @Post('cases/:id/strata-lot')
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Add strata lot' })
  async addLot(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.service.addStrataLot(id, dto);
  }

  @Get('cases/:id/strata-lots')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get strata lots for case' })
  async getLots(@Param('id', ParseUUIDPipe) id: string) { return this.service.getStrataLots(id); }

  @Get('strata/:planNumber')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get all lots by strata plan number' })
  async getByPlan(@Param('planNumber') planNumber: string) { return this.service.getStrataByPlan(planNumber); }
}
