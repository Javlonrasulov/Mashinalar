import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, Max, Min, ValidateNested } from 'class-validator';

export class ReverseGeocodePointDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class ReverseGeocodeBatchDto {
  @IsArray()
  @ArrayMaxSize(48)
  @ValidateNested({ each: true })
  @Type(() => ReverseGeocodePointDto)
  points!: ReverseGeocodePointDto[];
}
