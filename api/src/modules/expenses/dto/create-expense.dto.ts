import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  vehicleId!: string;

  @IsString()
  @MinLength(1)
  categoryId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  spentAt?: string;
}
