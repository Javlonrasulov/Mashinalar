-- AlterTable
ALTER TABLE "DailyKmReport" ADD COLUMN     "endLatitude" DECIMAL(10,7),
ADD COLUMN     "endLongitude" DECIMAL(10,7),
ADD COLUMN     "endRecordedAt" TIMESTAMP(3),
ADD COLUMN     "startLatitude" DECIMAL(10,7),
ADD COLUMN     "startLongitude" DECIMAL(10,7),
ADD COLUMN     "startRecordedAt" TIMESTAMP(3),
ALTER COLUMN "endKm" DROP NOT NULL;
