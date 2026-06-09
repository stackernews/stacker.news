-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cancelledAt" TIMESTAMP(3);

UPDATE "Invoice" SET "cancelledAt" = "expiresAt" WHERE "cancelled" = true;
