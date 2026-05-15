-- CreateTable
CREATE TABLE "FuelVedomostSnapshot" (
    "id" TEXT NOT NULL,
    "savedFuelStationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "FuelVedomostSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuelVedomostSnapshot_savedFuelStationId_year_month_createdAt_idx" ON "FuelVedomostSnapshot"("savedFuelStationId", "year", "month", "createdAt");

-- AddForeignKey
ALTER TABLE "FuelVedomostSnapshot" ADD CONSTRAINT "FuelVedomostSnapshot_savedFuelStationId_fkey" FOREIGN KEY ("savedFuelStationId") REFERENCES "SavedFuelStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
