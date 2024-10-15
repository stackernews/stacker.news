/*
  Warnings:

  - A unique constraint covering the columns `[preimage]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "preimage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice.preimage_unique" ON "Invoice"("preimage");
