-- CreateIndex
CREATE INDEX "ItemPayIn_itemId_payInId_idx" ON "ItemPayIn"("itemId", "payInId");

-- CreateIndex
CREATE INDEX "PayIn_id_payInType_payInState_userId_idx" ON "PayIn"("id", "payInType", "payInState", "userId");

-- CreateIndex
CREATE INDEX "SubPayOutCustodialToken_payOutCustodialTokenId_subName_idx" ON "SubPayOutCustodialToken"("payOutCustodialTokenId", "subName");
