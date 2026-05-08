import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyCaseController } from './property-case.controller';
import { PropertyCaseService } from './property-case.service';
import { PropertyCaseEntity } from './entities/property-case.entity';
import { TaxBalanceEntity } from './entities/tax-balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyCaseEntity, TaxBalanceEntity])],
  controllers: [PropertyCaseController],
  providers: [PropertyCaseService],
  exports: [PropertyCaseService],
})
export class PropertyCaseModule {}
