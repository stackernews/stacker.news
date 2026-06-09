-- Sat Filter Refactoring: Item Backfills + Index
-- Backfills netInvestment for existing rows
-- Backfills freebie column for historical items
-- Creates index on netInvestment
--
-- This migration only does DML (UPDATE) and CREATE INDEX, so it takes
-- RowExclusiveLock / ShareLock on Item — NOT AccessExclusiveLock.
-- Concurrent reads continue to work while this runs.

-- Backfill netInvestment for existing rows that still have the default (0)
UPDATE "Item" SET "netInvestment" = (
  COALESCE(cost, 0) +
  COALESCE(boost, 0) +
  (COALESCE(msats, 0) / 1000) -
  (COALESCE("downMsats", 0) / 1000)
)::integer
WHERE "netInvestment" != (
  COALESCE(cost, 0) +
  COALESCE(boost, 0) +
  (COALESCE(msats, 0) / 1000) -
  (COALESCE("downMsats", 0) / 1000)
)::integer;

-- Backfill freebie column for historical items
-- Previously /recent/freebies used "cost = 0", now it uses "freebie = true"
UPDATE "Item" SET freebie = true WHERE cost = 0 AND freebie IS NOT true;

-- Create index on netInvestment for efficient filtering
CREATE INDEX "Item_netInvestment_idx" ON "Item"("netInvestment");
