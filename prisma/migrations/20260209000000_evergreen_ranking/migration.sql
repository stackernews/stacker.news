-- Evergreen Ranking Refactor
-- 1. Drop STORED generated columns (rankhot, ranktop, rankboost)
-- 2. Drop old SQL functions (rankhot_sort_key, ranktop_sort_key)
-- 3. Re-add ranktop, hotCenteredSum, hotCenteredAt, rankhot as regular columns
-- 4. Create BEFORE trigger for ranktop
-- 5. Create SQL helper functions for hot centered sum updates
-- 6. Create BEFORE trigger for rankhot (from hotCenteredSum + hotCenteredAt)
-- 7. Merge oldBoost into boost, drop oldBoost
-- 8. Backfill ranktop, hotCenteredSum, hotCenteredAt (trigger computes rankhot)
-- 9. Remove AUCTION ranking type
-- 10. Recreate indexes

-- =====================
-- DROP INDEXES (must drop before dropping columns)
-- =====================
DROP INDEX IF EXISTS "Item_ranktop_idx";
DROP INDEX IF EXISTS "Item_rankhot_idx";
DROP INDEX IF EXISTS "Item_rankboost_idx";
DROP INDEX IF EXISTS "Item_subNames_ranktop_idx";
DROP INDEX IF EXISTS "Item_subNames_rankhot_idx";
DROP INDEX IF EXISTS "Item_subNames_rankboost_idx";
DROP INDEX IF EXISTS "Item_total_boost_idx";

-- =====================
-- DROP GENERATED COLUMNS
-- =====================
ALTER TABLE "Item" DROP COLUMN "ranktop";
ALTER TABLE "Item" DROP COLUMN "rankhot";
ALTER TABLE "Item" DROP COLUMN "rankboost";

-- =====================
-- DROP OLD FUNCTIONS
-- =====================
DROP FUNCTION IF EXISTS rankhot_sort_key;
DROP FUNCTION IF EXISTS ranktop_sort_key;

-- =====================
-- RE-ADD AS REGULAR COLUMNS (rankboost removed entirely)
-- =====================
ALTER TABLE "Item" ADD COLUMN "ranktop" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "hotCenteredSum" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "hotCenteredAt" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "rankhot" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- =====================
-- MERGE oldBoost INTO boost, THEN DROP oldBoost
-- =====================
UPDATE "Item" SET boost = boost + "oldBoost" WHERE "oldBoost" > 0;
ALTER TABLE "Item" DROP COLUMN "oldBoost";

-- =====================
-- CREATE TRIGGER FOR ranktop
-- =====================
CREATE OR REPLACE FUNCTION item_ranktop_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.ranktop := (
    COALESCE(NEW.cost, 0)::double precision * 1000.0
    + COALESCE(NEW.msats, 0)::double precision
    + COALESCE(NEW.boost, 0)::double precision * 1000.0
    + COALESCE(NEW."commentMsats", 0)::double precision * 0.25
    - COALESCE(NEW."downMsats", 0)::double precision
    - COALESCE(NEW."commentDownMsats", 0)::double precision * 0.1
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER item_ranktop
  BEFORE INSERT OR UPDATE OF cost, msats, boost, "commentMsats", "downMsats", "commentDownMsats" ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_ranktop_trigger();

-- =====================
-- CREATE SQL HELPER FUNCTIONS FOR HOT CENTERED SUM UPDATES
-- (half-life = 14400 seconds = 4 hours, lambda = ln(2) / 14400)
-- =====================

-- Returns the updated centered sum after adding contribution w at now()
-- All EXP() arguments are <= 0 by construction, so no overflow is possible
CREATE FUNCTION hot_centered_sum_update(old_sum DOUBLE PRECISION, old_at DOUBLE PRECISION, w DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN EXTRACT(EPOCH FROM now())::DOUBLE PRECISION >= old_at
    THEN old_sum * EXP(LN(2) * (old_at - EXTRACT(EPOCH FROM now())::DOUBLE PRECISION) / 14400.0) + w
    ELSE old_sum + w * EXP(LN(2) * (EXTRACT(EPOCH FROM now())::DOUBLE PRECISION - old_at) / 14400.0)
  END
$$;

-- Returns the updated centering time (always the latest of old and now)
CREATE FUNCTION hot_centered_at_update(old_at DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT GREATEST(old_at, EXTRACT(EPOCH FROM now())::DOUBLE PRECISION)
$$;

-- =====================
-- CREATE TRIGGER FOR rankhot (sort key from hotCenteredSum + hotCenteredAt)
-- Positive items: ln(sum) + lambda * t  (large positive ~83,000+)
-- Negative items: -(ln(|sum|) + lambda * t)  (large negative)
-- Zero items: 0  (ranks between positive and negative)
-- =====================
CREATE OR REPLACE FUNCTION item_rankhot_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.rankhot := CASE
    WHEN NEW."hotCenteredSum" > 0
      THEN LN(NEW."hotCenteredSum") + LN(2) / 14400.0 * NEW."hotCenteredAt"
    WHEN NEW."hotCenteredSum" < 0
      THEN -(LN(-NEW."hotCenteredSum") + LN(2) / 14400.0 * NEW."hotCenteredAt")
    ELSE 0
    END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER item_rankhot
  BEFORE INSERT OR UPDATE OF "hotCenteredSum", "hotCenteredAt" ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_rankhot_trigger();

-- =====================
-- BACKFILL ranktop
-- (triggers don't fire for UPDATE ... SET col = col, so we compute directly)
-- =====================
UPDATE "Item"
SET
  "ranktop" = (
    COALESCE(cost, 0)::double precision * 1000.0
    + COALESCE(msats, 0)::double precision
    + COALESCE(boost, 0)::double precision * 1000.0
    + COALESCE("commentMsats", 0)::double precision * 0.25
    - COALESCE("downMsats", 0)::double precision
    - COALESCE("commentDownMsats", 0)::double precision * 0.1
  );

-- =====================
-- BACKFILL hotCenteredSum and hotCenteredAt
-- Approximates all historical contributions as happening at created_at.
-- This produces the same ranking as the old rankhot_sort_key formula:
--   ln(ranktop/1000) + ln(2)/14400 * created_at_epoch
-- Per-contribution time-weighting kicks in for all new activity after migration.
-- The rankhot trigger auto-computes the sort key.
-- =====================
UPDATE "Item"
SET "hotCenteredSum" = ranktop / 1000.0,
    "hotCenteredAt" = EXTRACT(EPOCH FROM created_at)::DOUBLE PRECISION
WHERE ranktop <> 0;

-- =====================
-- REMOVE AUCTION RANKING TYPE
-- PG doesn't support DROP VALUE from enum, so we recreate it
-- =====================
UPDATE "Sub" SET "rankingType" = 'WOT' WHERE "rankingType" = 'AUCTION';

ALTER TYPE "RankingType" RENAME TO "RankingType_old";
CREATE TYPE "RankingType" AS ENUM ('WOT', 'RECENT');
ALTER TABLE "Sub" ALTER COLUMN "rankingType" TYPE "RankingType" USING "rankingType"::text::"RankingType";
DROP TYPE "RankingType_old";

-- =====================
-- RECREATE INDEXES
-- =====================
CREATE INDEX "Item_ranktop_idx" ON "Item"("ranktop");
CREATE INDEX "Item_rankhot_idx" ON "Item"("rankhot");
CREATE INDEX "Item_subNames_ranktop_idx" ON "Item" USING GIN ("subNames", "ranktop" float8_ops);
CREATE INDEX "Item_subNames_rankhot_idx" ON "Item" USING GIN ("subNames", "rankhot" float8_ops);
