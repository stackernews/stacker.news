-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "rootId" INTEGER;

-- CreateIndex
CREATE INDEX "Item.rootId_index" ON "Item"("rootId");

-- AddForeignKey
ALTER TABLE "Item" ADD FOREIGN KEY ("rootId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;