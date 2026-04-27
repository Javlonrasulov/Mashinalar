-- Add gas price per m³ to Vehicle for fuel volume calculation
ALTER TABLE "Vehicle" ADD COLUMN "gasPricePerM3" DECIMAL(14,2);

