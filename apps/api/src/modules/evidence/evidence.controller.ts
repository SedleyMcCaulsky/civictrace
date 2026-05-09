import {
  Controller, Post, Get, Delete, Param, Body,
  ParseUUIDPipe, Request, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EvidenceService } from './evidence.service';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

class UploadEvidenceDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false, default: 'PHOTO' }) @IsOptional() @IsString() evidenceType?: string;
}

@ApiTags('Evidence')
@ApiBearerAuth()
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly service: EvidenceService) {}

  @Post('cases/:caseId/upload')
  @RequirePermissions('evidence:upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, notes: { type: 'string' }, evidenceType: { type: 'string' } } } })
  @ApiOperation({ summary: 'Upload evidence file for a case' })
  async uploadEvidence(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadEvidenceDto,
    @Request() req: any,
  ) {
    return this.service.uploadEvidence(file, caseId, req.user.sub, dto);
  }

  @Get('cases/:caseId')
  @RequirePermissions('evidence:read')
  @ApiOperation({ summary: 'Get all evidence files for a case' })
  async getEvidence(@Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.service.getEvidenceForCase(caseId);
  }

  @Delete(':fileId')
  @RequirePermissions('evidence:invalidate')
  @ApiOperation({ summary: 'Delete an evidence file' })
  async deleteEvidence(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Request() req: any,
  ) {
    return this.service.deleteEvidence(fileId, req.user.sub);
  }
}
