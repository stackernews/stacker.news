-- Keep this as a single-statement migration so PostgreSQL can build the
-- replacement index without blocking ItemSub writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ItemSub_subName_itemId_idx"
ON "ItemSub" ("subName", "itemId");
