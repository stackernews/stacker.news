-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paymentAttempt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN     "retryPendingSince" TIMESTAMP(3);
CREATE INDEX "Invoice_cancelledAt_idx" ON "Invoice"("cancelledAt");

ALTER TABLE "users" ADD COLUMN     "sendWallets" BOOLEAN NOT NULL DEFAULT false;
