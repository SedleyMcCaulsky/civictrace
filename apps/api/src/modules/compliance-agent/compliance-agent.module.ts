import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceAgentController } from './compliance-agent.controller';
import { ComplianceAgentService } from './compliance-agent.service';
import { ComplianceAgentScheduler } from './compliance-agent.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [ComplianceAgentController],
  providers: [ComplianceAgentService, ComplianceAgentScheduler],
  exports: [ComplianceAgentService],
})
export class ComplianceAgentModule {}
