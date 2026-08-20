-- Denormalize the first successful ITEM_CREATE payment onto Item so feed
-- selection and ordering do not need to traverse ItemPayIn and PayIn.
ALTER TABLE "Item"
ADD COLUMN "paidAt" TIMESTAMP(3);

-- Keep the lock-taking DDL separate from the data backfill so its table lock
-- is released before the long-running update starts.
DROP TRIGGER IF EXISTS index_item ON "Item";
