-- Evergreen Ranking Refactor (combined migration)
-- IMPORTANT: run during full maintenance window (app + workers paused).
-- This migration takes long-lived locks on "Item" and later updates "Sub".
-- 1. Drop indexes for columns being dropped/changed
-- 2. Drop generated columns (ranktop, rankhot, rankboost)
-- 3. Drop old SQL functions
-- 4. Add new columns with final names
-- 5. Disable index_item trigger during bulk Item backfills
-- 6. Merge oldBoost into boost, drop oldBoost
-- 7. Define final ranking function
-- 8. Backfill commentCost, commentBoost
-- 9. Backfill ranktop (includes commentCost/commentBoost)
-- 10. Backfill litCenteredSum, litCenteredAt
-- 11. Create final combined ranking trigger
-- 12. Re-enable index_item trigger
-- 13. Remove AUCTION ranking type
-- 14. Recreate indexes

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
-- DISABLE ITEM INDEXING TRIGGER DURING BACKFILLS
-- (avoids per-row pgboss job writes while we bulk update Item)
-- =====================
ALTER TABLE "Item" DISABLE TRIGGER index_item;

-- =====================
-- MERGE oldBoost INTO boost, THEN DROP oldBoost
-- =====================
UPDATE "Item" SET boost = boost + "oldBoost" WHERE "oldBoost" > 0;
ALTER TABLE "Item" DROP COLUMN "oldBoost";

-- =====================
-- CREATE FINAL COMBINED RANKING FUNCTION
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

-- =====================
-- BACKFILL commentCost and commentBoost
-- (must happen before ranktop backfill since ranktop depends on them)
-- =====================
WITH paid_comment_items AS (
  -- Dedupe by item id so retries/duplicate pay-ins cannot double count.
  SELECT ip."itemId", i.cost, i.boost
  FROM "ItemPayIn" ip
  JOIN "PayIn" p ON p.id = ip."payInId"
  JOIN "Item" i ON i.id = ip."itemId"
  WHERE i."parentId" IS NOT NULL
    AND p."payInType" = 'ITEM_CREATE'
    AND p."payInState" = 'PAID'
  GROUP BY ip."itemId", i.cost, i.boost
), ancestor_totals AS (
  SELECT r."ancestorId" AS id,
    SUM(pci.cost) AS total_cost,
    SUM(pci.boost) AS total_boost
  FROM paid_comment_items pci
  JOIN "Reply" r ON r."itemId" = pci."itemId"
  GROUP BY r."ancestorId"
)
UPDATE "Item" AS parent
SET "commentCost" = COALESCE(ancestor_totals.total_cost, 0),
    "commentBoost" = COALESCE(ancestor_totals.total_boost, 0)
FROM ancestor_totals
WHERE parent.id = ancestor_totals.id;

-- =====================
-- BACKFILL ranktop
-- (computed directly so values are correct before enabling item_ranking)
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
-- CREATE FINAL COMBINED RANKING TRIGGER
-- (after backfills to avoid per-row trigger work during migration)
-- =====================
CREATE TRIGGER item_ranking
  BEFORE INSERT OR UPDATE OF cost, msats, boost, "commentMsats", "commentCost", "commentBoost", "downMsats", "commentDownMsats"
  ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_ranking_trigger();

-- =====================
-- RE-ENABLE ITEM INDEXING TRIGGER
-- =====================
ALTER TABLE "Item" ENABLE TRIGGER index_item;

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
