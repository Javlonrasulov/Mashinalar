import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class LocationPointInputDto {
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsString()
  recordedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accuracyM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  speed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heading?: number;
}

export class BatchLocationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationPointInputDto)
  points!: LocationPointInputDto[];
}
