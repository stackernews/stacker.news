/*
  Warnings:

  - A unique constraint covering the columns `[predecessorId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "predecessorId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice.predecessorId_unique" ON "Invoice"("predecessorId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
