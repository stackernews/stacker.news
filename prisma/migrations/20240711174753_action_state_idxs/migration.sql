-- CreateIndex
CREATE INDEX "Invoice_actionState_idx" ON "Invoice"("actionState");

-- CreateIndex
CREATE INDEX "Invoice_actionType_idx" ON "Invoice"("actionType");

-- CreateIndex
CREATE INDEX "Item_invoiceActionState_idx" ON "Item"("invoiceActionState");

-- CreateIndex
CREATE INDEX "ItemAct_invoiceActionState_idx" ON "ItemAct"("invoiceActionState");

-- CreateIndex
CREATE INDEX "PollBlindVote_invoiceActionState_idx" ON "PollBlindVote"("invoiceActionState");

-- CreateIndex
CREATE INDEX "PollVote_invoiceActionState_idx" ON "PollVote"("invoiceActionState");

-- CreateIndex
CREATE INDEX "Upload_invoiceActionState_idx" ON "Upload"("invoiceActionState");
