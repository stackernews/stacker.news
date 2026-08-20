-- Keep this as a single-statement migration: PostgreSQL cannot build a
-- concurrent index inside the transaction used for a multi-statement migration.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Item_paid_created_id_idx"
ON "Item" ((COALESCE("paidAt", created_at)) DESC, id DESC);
