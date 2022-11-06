-- CreateIndex
CREATE INDEX "Item.weightedVotes_index" ON "Item"("weightedVotes");

-- CreateIndex
CREATE INDEX "Item.weightedDownVotes_index" ON "Item"("weightedDownVotes");

-- CreateIndex
CREATE INDEX "Item.bio_index" ON "Item"("bio");

-- CreateIndex
CREATE INDEX "Item.freebie_index" ON "Item"("freebie");

-- CreateIndex
CREATE INDEX "Item.sumVotes_index" ON "Item"(("weightedVotes" - "weightedDownVotes"));
