import { Type } from 'class-transformer';
import { IsArray, IsDateString, ValidateNested } from 'class-validator';

export class GpsOffSegmentInputDto {
  @IsDateString()
  startedAt!: string;

  @IsDateString()
  endedAt!: string;
}

export class BatchGpsOffSegmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GpsOffSegmentInputDto)
  segments!: GpsOffSegmentInputDto[];
}
