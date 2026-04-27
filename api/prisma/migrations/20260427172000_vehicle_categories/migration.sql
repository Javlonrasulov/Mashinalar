-- VehicleCategory model + optional Vehicle.categoryId (safe if applied twice after DB push / P3005 skips)

CREATE TABLE IF NOT EXISTS "VehicleCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

DO $$
BEGIN
  ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "VehicleCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Vehicle_categoryId_idx" ON "Vehicle"("categoryId");
