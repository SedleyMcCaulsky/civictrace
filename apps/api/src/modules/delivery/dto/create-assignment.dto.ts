import { IsUUID, IsDateString, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty()
  @IsUUID()
  officerId: string;

  @ApiProperty()
  @IsUUID()
  areaId: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  assignmentDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  caseIds: string[];
}
