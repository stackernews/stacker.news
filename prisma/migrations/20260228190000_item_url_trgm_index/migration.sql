-- CreateIndex
CREATE INDEX IF NOT EXISTS "Item_url_trgm_idx"
ON "Item" USING GIN ("url" gin_trgm_ops);

-- DropIndex
DROP INDEX IF EXISTS "Item_url_idx";
