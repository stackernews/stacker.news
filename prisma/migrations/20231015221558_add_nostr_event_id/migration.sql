ALTER TABLE "Item" ADD COLUMN     "nEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Item.nEventId_unique" ON "Item"("nEventId");
