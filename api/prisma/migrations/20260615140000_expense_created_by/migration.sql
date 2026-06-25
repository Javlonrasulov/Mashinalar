-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "createdByUserId" TEXT;

-- Backfill from audit log where available
UPDATE "Expense" e
SET "createdByUserId" = al."actorUserId"
FROM "AuditLog" al
WHERE al."action" = 'expense.create'
  AND al."entity" = 'Expense'
  AND al."entityId" = e."id"
  AND al."actorUserId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Expense_createdByUserId_idx" ON "Expense"("createdByUserId");
