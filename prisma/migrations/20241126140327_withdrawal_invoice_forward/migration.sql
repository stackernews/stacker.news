/*
  Warnings:

  - A unique constraint covering the columns `[withdrawlId]` on the table `InvoiceForward` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "InvoiceForward_withdrawlId_key" ON "InvoiceForward"("withdrawlId");
