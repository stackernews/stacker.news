-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "actionArgs" JSONB,
ADD COLUMN     "actionError" TEXT,
ADD COLUMN     "actionResult" JSONB;
