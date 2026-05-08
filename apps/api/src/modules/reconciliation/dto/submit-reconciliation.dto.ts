import {
  IsString, IsNumber, IsDateString, IsArray,
  IsInt, Min, Max, IsOptional, MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReconciliationRecordDto {
  @ApiProperty({ example: 'NORBROOK' })
  @IsString()
  rawAreaCode: string;

  @ApiProperty({ example: '105C-2W-06-038' })
  @IsString()
  rawValuationNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rawOwnerName?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amountPaid: number;

  @ApiProperty()
  @IsDateString()
  paymentDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiProperty({ type: [Number], example: [2022, 2023] })
  @IsArray()
  @IsInt({ each: true })
  @Min(2000, { each: true })
  @Max(2100, { each: true })
  yearsCovered: number[];
}

export class SubmitReconciliationDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  batchReference: string;

  @ApiProperty()
  @IsDateString()
  reportPeriodStart: string;

  @ApiProperty()
  @IsDateString()
  reportPeriodEnd: string;

  @ApiProperty({ type: [ReconciliationRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReconciliationRecordDto)
  records: ReconciliationRecordDto[];
}
