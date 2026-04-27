import { IsString, MinLength } from 'class-validator';

export class CreateVehicleCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

