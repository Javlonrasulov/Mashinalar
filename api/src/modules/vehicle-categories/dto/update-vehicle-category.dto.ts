import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleCategoryDto } from './create-vehicle-category.dto';

export class UpdateVehicleCategoryDto extends PartialType(
  CreateVehicleCategoryDto,
) {}
