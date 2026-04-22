-- Daily KM: two-phase (start then end); optional end until completed; geo + timestamps for admin.

ALTER TABLE "DailyKmReport" ALTER COLUMN "endKm" DROP NOT NULL;

ALTER TABLE "DailyKmReport" ADD COLUMN "startLatitude" DECIMAL(10,7);
ALTER TABLE "DailyKmReport" ADD COLUMN "startLongitude" DECIMAL(10,7);
ALTER TABLE "DailyKmReport" ADD COLUMN "startRecordedAt" TIMESTAMP(3);
ALTER TABLE "DailyKmReport" ADD COLUMN "endLatitude" DECIMAL(10,7);
ALTER TABLE "DailyKmReport" ADD COLUMN "endLongitude" DECIMAL(10,7);
ALTER TABLE "DailyKmReport" ADD COLUMN "endRecordedAt" TIMESTAMP(3);
