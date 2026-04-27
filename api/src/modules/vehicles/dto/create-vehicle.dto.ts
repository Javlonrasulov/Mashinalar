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
  @IsOptional()
  @IsString()
  categoryId?: string;

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

  @IsOptional()
  @IsDateString()
  inspectionStartDate?: string;

  @IsOptional()
  @IsDateString()
  inspectionEndDate?: string;

  @IsOptional()
  @IsDateString()
  gasStartDate?: string;

  @IsOptional()
  @IsDateString()
  gasEndDate?: string;

}
