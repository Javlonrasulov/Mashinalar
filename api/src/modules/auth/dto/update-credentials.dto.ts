import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCredentialsDto {
  @IsString()
  currentPassword!: string;

  @IsOptional()
  @IsString()
  login?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}

