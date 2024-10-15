-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "confirmedIndex" BIGINT;

-- CreateIndex
CREATE INDEX "Invoice.confirmedIndex_index" ON "Invoice"("confirmedIndex");
