-- CreateIndex
CREATE INDEX "Item.status_index" ON "Item"("status");

-- CreateIndex
CREATE INDEX "Item.maxBid_index" ON "Item"("maxBid");

-- CreateIndex
CREATE INDEX "Item.statusUpdatedAt_index" ON "Item"("statusUpdatedAt");

-- CreateIndex
CREATE INDEX "Item.subName_index" ON "Item"("subName");

-- CreateIndex
CREATE INDEX "Item.pinId_index" ON "Item"("pinId");
