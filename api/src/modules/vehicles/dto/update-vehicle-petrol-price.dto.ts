import { IsNumber, ValidateIf } from 'class-validator';

/** Faqat `petrolPricePerLiter` — `null` bo‘lsa maydon tozalanadi */
export class UpdateVehiclePetrolPriceDto {
  @ValidateIf((_, v: unknown) => v !== null && v !== undefined)
  @IsNumber()
  petrolPricePerLiter!: number | null;
}
