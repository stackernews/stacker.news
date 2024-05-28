/*
  Warnings:

  - A unique constraint covering the columns `[invoiceId]` on the table `InvoiceForward` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "InvoiceForward_invoiceId_key" ON "InvoiceForward"("invoiceId");
