import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceOpsController } from './compliance-ops.controller';
import { ComplianceOpsService } from './compliance-ops.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [ComplianceOpsController, AnalyticsController],
  providers: [ComplianceOpsService, AnalyticsService],
  exports: [ComplianceOpsService, AnalyticsService],
})
export class ComplianceOpsModule {}
