-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseCategory_slug_key" ON "ExpenseCategory"("slug");

-- Default categories (stable ids for data migration)
INSERT INTO "ExpenseCategory" ("id", "slug", "name", "createdAt") VALUES
('cm_exp_cat_fuel', 'FUEL', 'Ёқилғи', CURRENT_TIMESTAMP),
('cm_exp_cat_repair', 'REPAIR', 'Таъмир', CURRENT_TIMESTAMP),
('cm_exp_cat_oil', 'OIL', 'Мой', CURRENT_TIMESTAMP),
('cm_exp_cat_other', 'OTHER', 'Бошқа', CURRENT_TIMESTAMP);

-- Add new column
ALTER TABLE "Expense" ADD COLUMN "categoryId" TEXT;

UPDATE "Expense" SET "categoryId" = CASE "type"::text
  WHEN 'FUEL' THEN 'cm_exp_cat_fuel'
  WHEN 'REPAIR' THEN 'cm_exp_cat_repair'
  WHEN 'OIL' THEN 'cm_exp_cat_oil'
  ELSE 'cm_exp_cat_other'
END;

ALTER TABLE "Expense" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "Expense" DROP COLUMN "type";

DROP TYPE "ExpenseType";

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
