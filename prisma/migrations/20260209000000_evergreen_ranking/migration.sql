-- Evergreen Ranking Refactor (combined migration)
-- 1. Drop indexes for columns being dropped/changed
-- 2. Drop generated columns (ranktop, rankhot, rankboost)
-- 3. Drop old SQL functions
-- 4. Add new columns with final names
-- 5. Merge oldBoost into boost, drop oldBoost
-- 6. Create final combined ranking trigger
-- 7. Backfill commentCost, commentBoost
-- 8. Backfill ranktop (includes commentCost/commentBoost)
-- 9. Backfill litCenteredSum, litCenteredAt (trigger computes ranklit)
-- 10. Remove AUCTION ranking type
-- 11. Recreate indexes

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
-- ADD NEW COLUMNS WITH FINAL NAMES
-- =====================
ALTER TABLE "Item" ADD COLUMN "ranktop" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "litCenteredSum" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "litCenteredAt" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "ranklit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "commentCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "commentBoost" INTEGER NOT NULL DEFAULT 0;

-- =====================
-- MERGE oldBoost INTO boost, THEN DROP oldBoost
-- =====================
UPDATE "Item" SET boost = boost + "oldBoost" WHERE "oldBoost" > 0;
ALTER TABLE "Item" DROP COLUMN "oldBoost";

-- =====================
-- CREATE FINAL COMBINED RANKING TRIGGER
-- (half-life = 14400 seconds = 4 hours, lambda = ln(2) / 14400)
-- Includes commentCost and commentBoost at 0.25x weight
-- =====================
CREATE OR REPLACE FUNCTION item_ranking_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  w DOUBLE PRECISION;
  old_sum DOUBLE PRECISION;
  old_at DOUBLE PRECISION;
  now_epoch DOUBLE PRECISION := EXTRACT(EPOCH FROM now())::DOUBLE PRECISION;
BEGIN
  -- 1. compute ranktop
  NEW.ranktop := (
    COALESCE(NEW.cost, 0)::double precision * 1000.0
    + COALESCE(NEW.msats, 0)::double precision
    + COALESCE(NEW.boost, 0)::double precision * 1000.0
    + COALESCE(NEW."commentMsats", 0)::double precision * 0.25
    + COALESCE(NEW."commentCost", 0)::double precision * 250.0
    + COALESCE(NEW."commentBoost", 0)::double precision * 250.0
    - COALESCE(NEW."downMsats", 0)::double precision
    - COALESCE(NEW."commentDownMsats", 0)::double precision * 0.1
  );

  -- 2. compute lit centered sum weight from field deltas
  IF TG_OP = 'INSERT' THEN
    w := (
      COALESCE(NEW.cost, 0)::double precision
      + COALESCE(NEW.msats, 0)::double precision / 1000.0
      + COALESCE(NEW.boost, 0)::double precision
      + COALESCE(NEW."commentMsats", 0)::double precision * 0.25 / 1000.0
      + COALESCE(NEW."commentCost", 0)::double precision * 0.25
      + COALESCE(NEW."commentBoost", 0)::double precision * 0.25
      - COALESCE(NEW."downMsats", 0)::double precision / 1000.0
      - COALESCE(NEW."commentDownMsats", 0)::double precision * 0.1 / 1000.0
    );
    old_sum := 0;
    old_at := 0;
  ELSE
    w := (
      (COALESCE(NEW.cost, 0) - COALESCE(OLD.cost, 0))::double precision
      + (COALESCE(NEW.msats, 0) - COALESCE(OLD.msats, 0))::double precision / 1000.0
      + (COALESCE(NEW.boost, 0) - COALESCE(OLD.boost, 0))::double precision
      + (COALESCE(NEW."commentMsats", 0) - COALESCE(OLD."commentMsats", 0))::double precision * 0.25 / 1000.0
      + (COALESCE(NEW."commentCost", 0) - COALESCE(OLD."commentCost", 0))::double precision * 0.25
      + (COALESCE(NEW."commentBoost", 0) - COALESCE(OLD."commentBoost", 0))::double precision * 0.25
      - (COALESCE(NEW."downMsats", 0) - COALESCE(OLD."downMsats", 0))::double precision / 1000.0
      - (COALESCE(NEW."commentDownMsats", 0) - COALESCE(OLD."commentDownMsats", 0))::double precision * 0.1 / 1000.0
    );
    old_sum := OLD."litCenteredSum";
    old_at := OLD."litCenteredAt";
  END IF;

  -- 3. update litCenteredSum via exponential decay centered at litCenteredAt
  --    EXP() arguments are <= 0 by construction (no overflow), but can underflow
  --    when the time gap exceeds ~168 days. GREATEST(..., -700) clamps the exponent
  --    to a safe range (IEEE 754 min ≈ -708); the decayed term is effectively 0.
  IF w <> 0 THEN
    IF now_epoch >= old_at THEN
      -- decay old sum to now, then add w
      NEW."litCenteredSum" := old_sum * EXP(GREATEST(LN(2) * (old_at - now_epoch) / 14400.0, -700.0)) + w;
    ELSE
      -- old_at is in the future: add w scaled by decay from old_at to now
      NEW."litCenteredSum" := old_sum + w * EXP(GREATEST(LN(2) * (now_epoch - old_at) / 14400.0, -700.0));
    END IF;
    NEW."litCenteredAt" := GREATEST(old_at, now_epoch);
  END IF;

  -- 4. compute ranklit sort key
  NEW.ranklit := CASE
    WHEN NEW."litCenteredSum" > 0
      THEN LN(NEW."litCenteredSum") + LN(2) / 14400.0 * NEW."litCenteredAt"
    WHEN NEW."litCenteredSum" < 0
      THEN -(LN(-NEW."litCenteredSum") + LN(2) / 14400.0 * NEW."litCenteredAt")
    ELSE 0
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER item_ranking
  BEFORE INSERT OR UPDATE OF cost, msats, boost, "commentMsats", "commentCost", "commentBoost", "downMsats", "commentDownMsats"
  ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_ranking_trigger();

-- =====================
-- BACKFILL commentCost and commentBoost
-- (must happen before ranktop backfill since ranktop depends on them)
-- =====================
UPDATE "Item" AS parent
SET "commentCost" = COALESCE(sub.total_cost, 0),
    "commentBoost" = COALESCE(sub.total_boost, 0)
FROM (
  SELECT a.id,
    SUM(d.cost) AS total_cost,
    SUM(d.boost) AS total_boost
  FROM "Item" a
  JOIN "Item" d ON d.path <@ a.path AND d.id <> a.id AND d."parentId" IS NOT NULL
  GROUP BY a.id
) sub
WHERE parent.id = sub.id;

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
    + COALESCE("commentCost", 0)::double precision * 250.0
    + COALESCE("commentBoost", 0)::double precision * 250.0
    - COALESCE("downMsats", 0)::double precision
    - COALESCE("commentDownMsats", 0)::double precision * 0.1
  );

-- =====================
-- BACKFILL litCenteredSum and litCenteredAt
-- Approximates all historical contributions as happening at created_at.
-- This produces the same ranking as the old rankhot_sort_key formula:
--   ln(ranktop/1000) + ln(2)/14400 * created_at_epoch
-- Per-contribution time-weighting kicks in for all new activity after migration.
-- ranklit must be computed inline because the trigger only fires on
-- cost/zap/boost column updates, not on litCenteredSum/litCenteredAt.
-- =====================
UPDATE "Item"
SET "litCenteredSum" = ranktop / 1000.0,
    "litCenteredAt" = EXTRACT(EPOCH FROM created_at)::DOUBLE PRECISION,
    "ranklit" = CASE
      WHEN ranktop > 0
        THEN LN(ranktop / 1000.0) + LN(2) / 14400.0 * EXTRACT(EPOCH FROM created_at)::DOUBLE PRECISION
      WHEN ranktop < 0
        THEN -(LN(-ranktop / 1000.0) + LN(2) / 14400.0 * EXTRACT(EPOCH FROM created_at)::DOUBLE PRECISION)
      ELSE 0
    END
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
CREATE INDEX "Item_ranklit_idx" ON "Item"("ranklit");
CREATE INDEX "Item_subNames_ranktop_idx" ON "Item" USING GIN ("subNames", "ranktop" float8_ops);
CREATE INDEX "Item_subNames_ranklit_idx" ON "Item" USING GIN ("subNames", "ranklit" float8_ops);
