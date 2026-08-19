CREATE INDEX IF NOT EXISTS "PayIn_paid_item_create_changed_idx"
ON "PayIn" ("payInStateChangedAt" DESC, id)
WHERE "payInType" = 'ITEM_CREATE'
  AND "payInState" = 'PAID';
