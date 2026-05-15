-- CreateTable
CREATE TABLE "FuelStationMonthActual" (
    "id" TEXT NOT NULL,
    "savedFuelStationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "actualM3" DECIMAL(14,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelStationMonthActual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuelStationMonthActual_savedFuelStationId_vehicleId_year_month_day_key" ON "FuelStationMonthActual"("savedFuelStationId", "vehicleId", "year", "month", "day");

-- CreateIndex
CREATE INDEX "FuelStationMonthActual_savedFuelStationId_year_month_idx" ON "FuelStationMonthActual"("savedFuelStationId", "year", "month");

-- AddForeignKey
ALTER TABLE "FuelStationMonthActual" ADD CONSTRAINT "FuelStationMonthActual_savedFuelStationId_fkey" FOREIGN KEY ("savedFuelStationId") REFERENCES "SavedFuelStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelStationMonthActual" ADD CONSTRAINT "FuelStationMonthActual_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
