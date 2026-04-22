import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  login!: string;

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
