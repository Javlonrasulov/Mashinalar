-- CreateTable
CREATE TABLE "SavedFuelStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFuelStation_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FuelReport" ADD COLUMN "savedFuelStationId" TEXT,
ADD COLUMN "stationLabel" TEXT;

-- AddForeignKey
ALTER TABLE "FuelReport" ADD CONSTRAINT "FuelReport_savedFuelStationId_fkey" FOREIGN KEY ("savedFuelStationId") REFERENCES "SavedFuelStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "FuelReport_savedFuelStationId_idx" ON "FuelReport"("savedFuelStationId");
