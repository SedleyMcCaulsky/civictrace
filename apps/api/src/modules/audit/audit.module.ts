import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [AuditController],
})
export class AuditModule {}
