import {
  Controller, Post, Get, Delete, Patch, Body, Param, Query,
  ParseUUIDPipe, Request, Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { LogDeliveryDto } from './dto/log-delivery.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Delivery')
@ApiBearerAuth()
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Post()
  @RequirePermissions('delivery:create')
  @ApiOperation({ summary: 'Log a delivery outcome' })
  async logDelivery(
    @Body() dto: LogDeliveryDto,
    @Request() req: any,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.service.logDelivery(dto, req.user.sub, deviceId);
  }

  @Post('sync')
  @RequirePermissions('delivery:create')
  @ApiOperation({ summary: 'Batch sync offline delivery records from mobile' })
  async batchSync(
    @Body() records: LogDeliveryDto[],
    @Request() req: any,
    @Headers('x-device-id') deviceId: string,
  ) {
    return this.service.batchSync(records, req.user.sub, deviceId);
  }

  @Post('assignments')
  @RequirePermissions('delivery:assign')
  @ApiOperation({ summary: 'Create officer field assignment' })
  async createAssignment(
    @Body() dto: CreateAssignmentDto,
    @Request() req: any,
  ) {
    return this.service.createAssignment(dto, req.user.sub);
  }

  @Get('assignments')
  @RequirePermissions('delivery:read')
  @ApiOperation({ summary: 'Get assignments for current officer' })
  async getMyAssignments(
    @Request() req: any,
    @Query('date') date?: string,
  ) {
    return this.service.getOfficerAssignments(req.user.sub, date);
  }

  @Get('assignments/:id/cases')
  @RequirePermissions('delivery:read')
  @ApiOperation({ summary: 'Get cases for a specific assignment' })
  async getAssignmentCases(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.service.getAssignmentCases(id, req.user.sub);
  }

  @Get('area/:areaId/summary')
  @RequirePermissions('delivery:read')
  @ApiOperation({ summary: 'Get delivery summary for an area' })
  async getAreaSummary(
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getAreaDeliverySummary(areaId, from, to);
  }

  @Get('assignments/all')
  @RequirePermissions('delivery:read')
  @ApiOperation({ summary: 'All assignments supervisor view' })
  async getAllAssignments(
    @Query('officerId') officerId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getAllAssignments({ officerId, status });
  }

  @Post('assignments/simple')
  @RequirePermissions('delivery:assign')
  @ApiOperation({ summary: 'Create assignment' })
  async createSimpleAssignment(@Body() dto: any, @Request() req: any) {
    return this.service.createSimpleAssignment(dto, req.user.sub);
  }

  @Patch('assignments/:id/status')
  @RequirePermissions('delivery:assign')
  @ApiOperation({ summary: 'Update assignment status' })
  async updateAssignmentStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.service.updateAssignmentStatus(id, status);
  }

  @Delete('assignments/:id/remove')
  @RequirePermissions('delivery:assign')
  @ApiOperation({ summary: 'Remove assignment' })
  async removeAssignment(@Param('id') id: string) {
    return this.service.removeAssignment(id);
  }

  @Get('officers')
  @RequirePermissions('delivery:read')
  @ApiOperation({ summary: 'Get officers list' })
  async getOfficers() {
    return this.service.getOfficers();
  }
}
