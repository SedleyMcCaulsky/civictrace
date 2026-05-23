import { Delete, Controller, Get, Post, Patch, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComplianceAgentService } from './compliance-agent.service';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Compliance Agent')
@ApiBearerAuth()
@Controller('agent')
export class ComplianceAgentController {
  constructor(private readonly service: ComplianceAgentService) {}

  @Post('run')
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Trigger nightly compliance agent run manually' })
  async runAgent() {
    return this.service.runNightlyAgent();
  }

  @Get('queue')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get agent action queue' })
  async getQueue(@Query('status') status?: string) {
    return this.service.getQueue(status);
  }

  @Get('queue/stats')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get queue statistics' })
  async getStats() {
    return this.service.getQueueStats();
  }

  @Post('queue/:id/approve')
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Approve and execute an agent recommendation' })
  async approve(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    return this.service.approveQueueItem(id, req.user.sub, notes);
  }

  @Post('queue/:id/reject')
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Reject an agent recommendation' })
  async reject(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    return this.service.rejectQueueItem(id, req.user.sub, notes);
  }

  @Delete('queue/clear')
  @RequirePermissions('agent:manage')
  @ApiOperation({ summary: 'Clear rejected and executed queue items' })
  async clearQueue(@Query('status') status: string) {
    return this.service.clearQueue(status);
  }

}