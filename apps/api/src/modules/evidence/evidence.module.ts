import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    MulterModule.register({ storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
