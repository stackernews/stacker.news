-- CreateIndex
CREATE INDEX "Item_invoicePaidAt_idx" ON "Item"("invoicePaidAt");
CREATE INDEX "Item_paid_created_idx" ON "Item" (COALESCE("invoicePaidAt", created_at) DESC);