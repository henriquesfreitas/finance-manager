CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budget_items" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "itemDate" DATE NOT NULL,
    "description" VARCHAR(500),
    "additionalInfo" VARCHAR(2000),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "budgets_ownerId_createdAt_idx" ON "budgets"("ownerId", "createdAt");
CREATE INDEX "budget_items_budgetId_itemDate_createdAt_idx" ON "budget_items"("budgetId", "itemDate", "createdAt");

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "admin_users"
SET "permissions" = array_append("permissions", 'BUDGET'::"AppPermission")
WHERE "username" = 'admin_finance'
  AND NOT ('BUDGET'::"AppPermission" = ANY("permissions"));
