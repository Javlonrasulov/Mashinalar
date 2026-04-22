import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsString()
  plateNumber!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialKm!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lastOilChangeKm?: number;

  @IsOptional()
  @IsDateString()
  lastOilChangeAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  oilChangeIntervalKm?: number;

  @IsOptional()
  @IsDateString()
  insuranceStartDate?: string;

  @IsOptional()
  @IsDateString()
  insuranceEndDate?: string;
}
