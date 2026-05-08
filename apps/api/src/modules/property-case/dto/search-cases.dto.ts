import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchCasesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiProperty({ required: false, example: 'NORBROOK' })
  @IsOptional()
  @IsString()
  areaCode?: string;

  @ApiProperty({ required: false, example: '105C-2W-06-038' })
  @IsOptional()
  @IsString()
  valuationNumber?: string;

  @ApiProperty({ required: false, example: 'John Brown' })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  compositeKey?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
