-- CreateTable
CREATE TABLE "CommentsViewAt" (
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentsViewAt_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateIndex
CREATE INDEX "CommentsViewAt_userId_idx" ON "CommentsViewAt"("userId");

-- AddForeignKey
ALTER TABLE "CommentsViewAt" ADD CONSTRAINT "CommentsViewAt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentsViewAt" ADD CONSTRAINT "CommentsViewAt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
