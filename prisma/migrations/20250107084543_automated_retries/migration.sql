-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paymentAttempt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN     "retryPendingSince" TIMESTAMP(3);
CREATE INDEX "Invoice_cancelledAt_idx" ON "Invoice"("cancelledAt");
