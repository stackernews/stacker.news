-- AlterTable
ALTER TABLE "Bookmark" ADD COLUMN     "custom_order" INTEGER;

-- CreateIndex
CREATE INDEX "Bookmark.custom_order_index" ON "Bookmark"("custom_order");
