-- These GIN indexes can filter their scalar columns but cannot provide the
-- ordering used by item feeds. Keep the smaller Item_subNames_idx for the
-- remaining array-containment queries.
DROP INDEX IF EXISTS "Item_subNames_created_at_idx";
DROP INDEX IF EXISTS "Item_subNames_ranktop_idx";
DROP INDEX IF EXISTS "Item_subNames_ranklit_idx";
DROP INDEX IF EXISTS "Item_subNames_downMsats_idx";
DROP INDEX IF EXISTS "Item_subNames_ncomments_idx";
