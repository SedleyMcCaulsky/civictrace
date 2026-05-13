import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxDriveController } from './tax-drive.controller';
import { TaxDriveService } from './tax-drive.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [TaxDriveController],
  providers: [TaxDriveService],
  exports: [TaxDriveService],
})
export class TaxDriveModule {}
