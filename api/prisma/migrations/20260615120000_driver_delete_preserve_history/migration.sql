-- Haydovchi o'chirilganda mashina tarixi (bog'lanish, zapravka, kun km, moy) saqlansin.

ALTER TABLE "DriverVehicleAssignment" ADD COLUMN "driverFullName" TEXT;
ALTER TABLE "DriverVehicleAssignment" ADD COLUMN "driverPhone" TEXT;

ALTER TABLE "DriverVehicleAssignment" DROP CONSTRAINT "DriverVehicleAssignment_driverId_fkey";
ALTER TABLE "DriverVehicleAssignment" ALTER COLUMN "driverId" DROP NOT NULL;
ALTER TABLE "DriverVehicleAssignment" ADD CONSTRAINT "DriverVehicleAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "DriverVehicleAssignment" dva
SET "driverFullName" = d."fullName", "driverPhone" = d."phone"
FROM "Driver" d
WHERE dva."driverId" = d."id";

ALTER TABLE "FuelReport" ADD COLUMN "driverFullName" TEXT;

ALTER TABLE "FuelReport" DROP CONSTRAINT "FuelReport_driverId_fkey";
ALTER TABLE "FuelReport" ALTER COLUMN "driverId" DROP NOT NULL;
ALTER TABLE "FuelReport" ADD CONSTRAINT "FuelReport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "FuelReport" fr
SET "driverFullName" = d."fullName"
FROM "Driver" d
WHERE fr."driverId" = d."id";

ALTER TABLE "DailyKmReport" ADD COLUMN "driverFullName" TEXT;

ALTER TABLE "DailyKmReport" DROP CONSTRAINT "DailyKmReport_driverId_fkey";
ALTER TABLE "DailyKmReport" ALTER COLUMN "driverId" DROP NOT NULL;
ALTER TABLE "DailyKmReport" ADD CONSTRAINT "DailyKmReport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "DailyKmReport" dkr
SET "driverFullName" = d."fullName"
FROM "Driver" d
WHERE dkr."driverId" = d."id";

ALTER TABLE "OilChangeReport" ADD COLUMN "driverFullName" TEXT;

ALTER TABLE "OilChangeReport" DROP CONSTRAINT "OilChangeReport_driverId_fkey";
ALTER TABLE "OilChangeReport" ALTER COLUMN "driverId" DROP NOT NULL;
ALTER TABLE "OilChangeReport" ADD CONSTRAINT "OilChangeReport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "OilChangeReport" ocr
SET "driverFullName" = d."fullName"
FROM "Driver" d
WHERE ocr."driverId" = d."id";
