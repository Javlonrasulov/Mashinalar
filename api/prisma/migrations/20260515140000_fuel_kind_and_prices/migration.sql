-- CreateEnum
CREATE TYPE "FuelKind" AS ENUM ('GAS', 'PETROL');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "petrolPricePerLiter" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "FuelReport" ADD COLUMN "fuelKind" "FuelKind" NOT NULL DEFAULT 'GAS';
ALTER TABLE "FuelReport" ADD COLUMN "unitPrice" DECIMAL(14,4);
ALTER TABLE "FuelReport" ADD COLUMN "volume" DECIMAL(14,4);
