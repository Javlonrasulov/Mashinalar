-- Sessiyani chiqarib yuborish: alohida session uchun `revokedAt`, hammasi uchun `User.tokenEpoch`.
ALTER TABLE "UserSession" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "tokenEpoch" INTEGER NOT NULL DEFAULT 0;
