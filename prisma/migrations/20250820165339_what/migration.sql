-- CreateTable
CREATE TABLE "ItemUserView" (
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemUserView_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateIndex
CREATE INDEX "ItemUserView_userId_idx" ON "ItemUserView"("userId");

-- CreateIndex
CREATE INDEX "Item.id_createdAt_index" ON "Item"("id", "created_at");

-- AddForeignKey
ALTER TABLE "ItemUserView" ADD CONSTRAINT "ItemUserView_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUserView" ADD CONSTRAINT "ItemUserView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
