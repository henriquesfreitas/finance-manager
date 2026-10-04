CREATE TABLE "bill_month_settlements" (
    "month" VARCHAR(7) NOT NULL,
    "settlementPaid" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_month_settlements_pkey" PRIMARY KEY ("month")
);
