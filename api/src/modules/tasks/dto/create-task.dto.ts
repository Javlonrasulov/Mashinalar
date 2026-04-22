import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  vehicleId!: string;

  @IsString()
  driverId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsDateString()
  deadlineAt!: string;
}
