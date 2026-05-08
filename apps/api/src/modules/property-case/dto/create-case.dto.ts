import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum PropertyType {
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  INDUSTRIAL = 'INDUSTRIAL',
  AGRICULTURAL = 'AGRICULTURAL',
  MIXED_USE = 'MIXED_USE',
  VACANT_LAND = 'VACANT_LAND',
  GOVERNMENT = 'GOVERNMENT',
  INSTITUTIONAL = 'INSTITUTIONAL',
  OTHER = 'OTHER',
}

export class TaxBalanceDto {
  @ApiProperty({ example: 2023 })
  @IsNumber()
  @Min(2000)
  @Max(2100)
  taxYear: number;

  @ApiProperty({ example: 45000.00 })
  @IsNumber()
  @Min(0)
  amountDue: number;
}

export class CreateCaseDto {
  @ApiProperty({ example: 'uuid-of-area' })
  @IsUUID()
  areaId: string;

  @ApiProperty({ example: '105C-2W-06-038' })
  @IsString()
  @MinLength(3)
  valuationNumber: string;

  @ApiProperty({ example: 'John Brown' })
  @IsString()
  @MinLength(2)
  ownerName: string;

  @ApiProperty({ example: '14 Norbrook Drive, Kingston 8' })
  @IsString()
  propertyAddress: string;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  propertyType: PropertyType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  volume?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  folio?: string;

  @ApiProperty({ type: [TaxBalanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxBalanceDto)
  taxBalances: TaxBalanceDto[];
}
