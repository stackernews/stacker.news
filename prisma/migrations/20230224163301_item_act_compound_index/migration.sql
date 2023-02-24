-- CreateIndex
CREATE INDEX "Bookmark.created_at_index" ON "Bookmark"("created_at");

-- CreateIndex
CREATE INDEX "ItemAct.itemId_act_userId_index" ON "ItemAct"("itemId", "act", "userId");
