import {
  Controller, Post, Get, Body, Param, ParseUUIDPipe, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { SubmitReconciliationDto } from './dto/submit-reconciliation.dto';
import { Throttle } from '@nestjs/throttler';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Reconciliation')
@ApiBearerAuth()
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Throttle({ medium: { ttl: 60000, limit: 10 } })
  @Post('batch')
  @RequirePermissions('reconciliation:create')
  @ApiOperation({ summary: 'Submit a payment reconciliation batch' })
  async submitBatch(@Body() dto: SubmitReconciliationDto, @Request() req: any) {
    return this.service.submitBatch(dto, req.user.sub);
  }

  @Get('batch/:id')
  @RequirePermissions('reconciliation:read')
  @ApiOperation({ summary: 'Get reconciliation batch details' })
  async getBatch(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getBatchSummary(id);
  }

  @Get('batches')
  @RequirePermissions('reconciliation:read')
  @ApiOperation({ summary: 'Get recent reconciliation batches' })
  async getRecentBatches(@Request() req: any) {
    return this.service.getRecentBatches(req.user.sub);
  }
}
