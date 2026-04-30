-- Haydovchi qurilmada GPS o‘chirilgan davrlar (xarita tahlili uchun).
CREATE TABLE "GpsOffSegment" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpsOffSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GpsOffSegment_vehicleId_startedAt_idx" ON "GpsOffSegment"("vehicleId", "startedAt");

CREATE UNIQUE INDEX "GpsOffSegment_vehicleId_startedAt_endedAt_key" ON "GpsOffSegment"("vehicleId", "startedAt", "endedAt");

ALTER TABLE "GpsOffSegment" ADD CONSTRAINT "GpsOffSegment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GpsOffSegment" ADD CONSTRAINT "GpsOffSegment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
