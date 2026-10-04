CREATE TYPE "BillPayer" AS ENUM ('HENRIQUE', 'AMANDA');

CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "billDate" DATE NOT NULL,
    "paidBy" "BillPayer",
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bills_billDate_createdAt_idx" ON "bills"("billDate", "createdAt");
