import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDriverDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  login!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  fullName!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}
