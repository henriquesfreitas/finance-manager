-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'TREASURY');

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "currentValue" DECIMAL(18,8),
ADD COLUMN     "treasuryProductId" TEXT,
ADD COLUMN     "type" "AssetType" NOT NULL DEFAULT 'STOCK';

-- CreateTable
CREATE TABLE "treasury_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "treasury_products_name_key" ON "treasury_products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_products_slug_key" ON "treasury_products"("slug");

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_treasuryProductId_fkey" FOREIGN KEY ("treasuryProductId") REFERENCES "treasury_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
