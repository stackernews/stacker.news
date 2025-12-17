-- CreateIndex
CREATE INDEX "Item_subName_created_at_idx" ON "Item"("subName", "created_at");

-- CreateIndex
CREATE INDEX "Item_subName_ranktop_idx" ON "Item"("subName", "ranktop");

-- CreateIndex
CREATE INDEX "Item_subName_rankhot_idx" ON "Item"("subName", "rankhot");
