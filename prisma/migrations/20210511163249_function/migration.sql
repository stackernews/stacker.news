/*
  Warnings:

  - A unique constraint covering the columns `[hash]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Invoice.hash_unique" ON "Invoice"("hash");