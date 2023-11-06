ALTER TABLE "Item" ADD COLUMN     "noteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Item.noteId_unique" ON "Item"("noteId");
