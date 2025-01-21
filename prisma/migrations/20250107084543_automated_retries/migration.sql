-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paymentAttempt" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Invoice_cancelledAt_idx" ON "Invoice"("cancelledAt");

-- AlterEnum
ALTER TYPE "InvoiceActionState" ADD VALUE 'RETRY_PENDING';