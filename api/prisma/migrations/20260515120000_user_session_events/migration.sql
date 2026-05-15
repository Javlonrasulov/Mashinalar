CREATE TABLE "UserSessionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT,
    "deviceLabel" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSessionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserSessionEvent_userId_recordedAt_idx" ON "UserSessionEvent"("userId", "recordedAt");

ALTER TABLE "UserSessionEvent" ADD CONSTRAINT "UserSessionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
