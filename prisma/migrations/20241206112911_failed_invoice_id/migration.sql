/*
  Warnings:

  - A unique constraint covering the columns `[failedInvoiceId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "failedInvoiceId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice.failedInvoiceId_unique" ON "Invoice"("failedInvoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_failedInvoiceId_fkey" FOREIGN KEY ("failedInvoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
