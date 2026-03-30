CREATE INDEX IF NOT EXISTS "Item_downMsats_idx" ON "Item" ("downMsats");
CREATE INDEX IF NOT EXISTS "Item_ncomments_idx" ON "Item" ("ncomments");
CREATE INDEX IF NOT EXISTS "Item_subNames_downMsats_idx" ON "Item" USING GIN ("subNames", "downMsats" int8_ops);
CREATE INDEX IF NOT EXISTS "Item_subNames_ncomments_idx" ON "Item" USING GIN ("subNames", "ncomments" int4_ops);
CREATE INDEX IF NOT EXISTS "Item_userId_ranktop_idx" ON "Item" ("userId", "ranktop");
CREATE INDEX IF NOT EXISTS "Item_userId_downMsats_idx" ON "Item" ("userId", "downMsats");
CREATE INDEX IF NOT EXISTS "Item_userId_ncomments_idx" ON "Item" ("userId", "ncomments");
