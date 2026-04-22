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
  @IsString()
  @MinLength(6)
  password?: string;
}
