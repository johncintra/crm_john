-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "originAmount" INTEGER,
ADD COLUMN "originCurrency" TEXT,
ADD COLUMN "originProductName" TEXT,
ADD COLUMN "originOrderStatus" "OrderStatus";
