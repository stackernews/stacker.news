-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceActionState" ADD VALUE 'FORWARDING';
ALTER TYPE "InvoiceActionState" ADD VALUE 'FORWARDED';
ALTER TYPE "InvoiceActionState" ADD VALUE 'FAILED_FORWARD';
ALTER TYPE "InvoiceActionState" ADD VALUE 'CANCELING';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "actionOptimistic" BOOLEAN;

-- AlterTable
ALTER TABLE "Withdrawl" ADD COLUMN     "preimage" TEXT;

-- CreateTable
CREATE TABLE "InvoiceForward" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bolt11" TEXT NOT NULL,
    "maxFeeMsats" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "expiryHeight" INTEGER,
    "acceptHeight" INTEGER,
    "invoiceId" INTEGER NOT NULL,
    "withdrawlId" INTEGER,

    CONSTRAINT "InvoiceForward_pkey" PRIMARY KEY ("id")
);

-- historically, optimistic actions were exclusively non-hold invoices
-- with invoice forwards, we can now have optimistic hold invoices
UPDATE "Invoice"
SET "actionOptimistic" = preimage IS NULL
WHERE "actionType" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceForward_invoiceId_key" ON "InvoiceForward"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceForward_invoiceId_idx" ON "InvoiceForward"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceForward_walletId_idx" ON "InvoiceForward"("walletId");

-- CreateIndex
CREATE INDEX "InvoiceForward_withdrawlId_idx" ON "InvoiceForward"("withdrawlId");

-- CreateIndex
CREATE INDEX "Invoice_isHeld_idx" ON "Invoice"("isHeld");

-- CreateIndex
CREATE INDEX "Invoice_confirmedAt_idx" ON "Invoice"("confirmedAt");

-- CreateIndex
CREATE INDEX "Withdrawl_walletId_idx" ON "Withdrawl"("walletId");

-- CreateIndex
CREATE INDEX "Withdrawl_autoWithdraw_idx" ON "Withdrawl"("autoWithdraw");

-- CreateIndex
CREATE INDEX "Withdrawl_status_idx" ON "Withdrawl"("status");

-- AddForeignKey
ALTER TABLE "InvoiceForward" ADD CONSTRAINT "InvoiceForward_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceForward" ADD CONSTRAINT "InvoiceForward_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceForward" ADD CONSTRAINT "InvoiceForward_withdrawlId_fkey" FOREIGN KEY ("withdrawlId") REFERENCES "Withdrawl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
