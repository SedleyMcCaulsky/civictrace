import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummonsController } from './summons.controller';
import { SummonsService } from './summons.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [SummonsController],
  providers: [SummonsService],
  exports: [SummonsService],
})
export class SummonsModule {}
