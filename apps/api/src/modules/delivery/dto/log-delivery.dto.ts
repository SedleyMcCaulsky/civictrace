import {
  IsUUID, IsEnum, IsOptional, IsString,
  IsNumber, Min, Max, IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DeliveryStatus {
  DELIVERED = 'DELIVERED',
  OWNER_ABSENT = 'OWNER_ABSENT',
  REFUSED = 'REFUSED',
  VACANT = 'VACANT',
  INCORRECT_ADDRESS = 'INCORRECT_ADDRESS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  DEMOLISHED = 'DEMOLISHED',
  RESCHEDULED = 'RESCHEDULED',
  ESCALATED = 'ESCALATED',
}

export class LogDeliveryDto {
  @ApiProperty()
  @IsUUID()
  propertyCaseId: string;

  @ApiProperty({ enum: DeliveryStatus })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90) @Max(90)
  gpsLat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180) @Max(180)
  gpsLng?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gpsAccuracyM?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  deliveredAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  localId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientVersion?: string;
}
