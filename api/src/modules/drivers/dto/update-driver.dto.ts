import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? undefined : t;
  })
  @IsString()
  @MinLength(6)
  password?: string;
}
