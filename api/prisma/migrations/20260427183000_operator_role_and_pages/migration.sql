-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'OPERATOR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "position" TEXT,
ADD COLUMN "allowedPages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
