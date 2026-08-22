-- The composite replacement supports the same subName lookups and also
-- provides itemId without visiting the ItemSub heap.
DROP INDEX CONCURRENTLY "ItemSub_subName_idx";
