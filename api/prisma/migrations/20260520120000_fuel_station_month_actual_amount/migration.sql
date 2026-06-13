-- Vedomost katakchasi: summa kiritilgan vaqtdagi narx bilan saqlanadi
ALTER TABLE "FuelStationMonthActual" ADD COLUMN "actualAmount" DECIMAL(14,2);

UPDATE "FuelStationMonthActual" f
SET "actualAmount" = ROUND((f."actualM3" * v."gasPricePerM3")::numeric, 0)
FROM "Vehicle" v
WHERE f."vehicleId" = v.id
  AND v."gasPricePerM3" IS NOT NULL
  AND v."gasPricePerM3" > 0;
