-- CreateIndex
CREATE INDEX "AggPayIn_subName_idx" ON "AggPayIn"("subName");

-- CreateIndex
CREATE INDEX "AggPayOut_subName_idx" ON "AggPayOut"("subName");

-- CreateIndex
CREATE INDEX "SubAct_subName_idx" ON "SubAct"("subName");

-- CreateIndex
CREATE INDEX "SubSubscription_subName_idx" ON "SubSubscription"("subName");

-- CreateIndex
CREATE INDEX "TerritoryTransfer_subName_idx" ON "TerritoryTransfer"("subName");

-- CreateIndex
CREATE INDEX "UserSubTrust_subName_idx" ON "UserSubTrust"("subName");
