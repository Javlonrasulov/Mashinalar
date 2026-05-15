import { IsNumber, ValidateIf } from 'class-validator';

/** Faqat `gasPricePerM3` — `null` bo‘lsa maydon tozalanadi */
export class UpdateVehicleGasPriceDto {
  @ValidateIf((_, v: unknown) => v !== null && v !== undefined)
  @IsNumber()
  gasPricePerM3!: number | null;
}
