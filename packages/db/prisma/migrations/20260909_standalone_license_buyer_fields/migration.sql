-- AlterTable
ALTER TABLE "StandaloneLicense" ADD COLUMN     "buyerEmail" TEXT,
ADD COLUMN     "buyerName" TEXT,
ADD COLUMN     "buyerPhone" TEXT,
ALTER COLUMN "tenantId" DROP NOT NULL;
