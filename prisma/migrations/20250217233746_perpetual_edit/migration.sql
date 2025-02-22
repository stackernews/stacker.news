-- We store into OldItem the history of the item that gets edited by the user

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "cloneBornAt" TIMESTAMP(3),
ADD COLUMN     "cloneDiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OldItem" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "text" TEXT,
    "url" TEXT,
    "userId" INTEGER NOT NULL,
    "subName" CITEXT,
    "imgproxyUrls" JSONB,
    "cloneBornAt" TIMESTAMP(3),
    "cloneDiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "original_itemId" INTEGER NOT NULL,

    CONSTRAINT "OldItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OldItem_created_at_idx" ON "OldItem"("created_at");

-- CreateIndex
CREATE INDEX "OldItem_userId_idx" ON "OldItem"("userId");

-- CreateIndex
CREATE INDEX "OldItem_original_itemId_idx" ON "OldItem"("original_itemId");

-- CreateIndex -- history of the item
CREATE INDEX "OldItem_original_itemId_cloneDiedAt_idx" ON "OldItem"("original_itemId", "cloneDiedAt" DESC);

-- AddForeignKey
ALTER TABLE "OldItem" ADD CONSTRAINT "OldItem_original_itemId_fkey" FOREIGN KEY ("original_itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
