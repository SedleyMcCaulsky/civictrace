import { Controller, Post, Get, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

class FormalizeNoteDto {
  @ApiProperty() @IsString() compositeKey: string;
  @ApiProperty() @IsString() ownerName: string;
  @ApiProperty() @IsString() address: string;
  @ApiProperty() @IsString() status: string;
  @ApiProperty() @IsString() @MinLength(5) note: string;
}

@ApiTags('AI Intelligence')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('cases/:id/narrative')
  @RequirePermissions('compliance:read')
  @ApiOperation({ summary: 'Generate formal compliance narrative for a case' })
  async generateNarrative(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.generateComplianceNarrative(id);
  }

  @Post('cases/:id/risk-score')
  @RequirePermissions('compliance:risk_view')
  @ApiOperation({ summary: 'Generate AI risk score for a case' })
  async generateRiskScore(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.generateRiskScore(id);
  }

  @Get('executive-summary')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Generate AI executive summary' })
  async generateExecutiveSummary() {
    return this.aiService.generateExecutiveSummary();
  }

  @Post('formalize-note')
  @RequirePermissions('delivery:create')
  @ApiOperation({ summary: 'Convert officer note to formal compliance entry' })
  async formalizeNote(@Body() dto: FormalizeNoteDto) {
    return this.aiService.formalizeOfficerNote(dto.note, dto);
  }
}
