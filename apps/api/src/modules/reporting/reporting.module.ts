import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { EmailService } from './email.service';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [ReportingController],
  providers: [ReportingService, EmailService, SchedulerService],
  exports: [ReportingService],
})
export class ReportingModule {}
