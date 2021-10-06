-- CreateIndex
CREATE INDEX "Invoice.created_at_index" ON "Invoice"("created_at");

-- CreateIndex
CREATE INDEX "Item.created_at_index" ON "Item"("created_at");

-- CreateIndex
CREATE INDEX "ItemAct.created_at_index" ON "ItemAct"("created_at");

-- CreateIndex
CREATE INDEX "Mention.created_at_index" ON "Mention"("created_at");

-- CreateIndex
CREATE INDEX "Withdrawl.created_at_index" ON "Withdrawl"("created_at");

-- CreateIndex
CREATE INDEX "users.created_at_index" ON "users"("created_at");
