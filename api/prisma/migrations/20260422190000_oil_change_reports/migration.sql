-- CreateTable
CREATE TABLE "OilChangeReport" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "kmAtChange" DECIMAL(12,2) NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OilChangeReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OilChangeReport_vehicleId_createdAt_idx" ON "OilChangeReport"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "OilChangeReport_driverId_idx" ON "OilChangeReport"("driverId");

-- AddForeignKey
ALTER TABLE "OilChangeReport" ADD CONSTRAINT "OilChangeReport_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OilChangeReport" ADD CONSTRAINT "OilChangeReport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
