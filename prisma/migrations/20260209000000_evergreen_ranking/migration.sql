-- Evergreen Ranking Refactor
-- 1. Drop STORED generated columns (rankhot, ranktop, rankboost)
-- 2. Drop old SQL functions (rankhot_sort_key, ranktop_sort_key)
-- 3. Re-add ranktop and rankhot as regular columns (rankboost removed entirely)
-- 4. Create BEFORE trigger for ranktop
-- 5. Merge oldBoost into boost, drop oldBoost
-- 6. Backfill ranktop and rankhot
-- 7. Remove AUCTION ranking type
-- 8. Recreate indexes

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
-- BACKFILL rankhot
-- sigma = 14400 seconds (4 hours), matching the old ln(2)/4 hour doubling time
-- rankhot_i = sum_j exp(t_j / sigma) * a_j
-- We accumulate from: ITEM_CREATE (cost), ZAP (sats), DOWN_ZAP (-sats), BOOST (sats)
-- For ancestors, comment ZAPs contribute at 0.25 weight, comment DOWN_ZAPs at 0.1 weight
-- (matching ranktop coefficients for commentMsats and commentDownMsats)
-- =====================

-- Step 1: All direct contributions in a single UPDATE
-- Combines item cost + ZAP + DOWN_ZAP + BOOST, only touching items that have contributions
UPDATE "Item"
SET rankhot = sub.contribution
FROM (
  SELECT item_id, SUM(contribution) AS contribution
  FROM (
    -- Item cost (seeded at creation time)
    SELECT id AS item_id,
      EXP(EXTRACT(EPOCH FROM created_at) / 14400.0) * cost AS contribution
    FROM "Item"
    WHERE cost > 0

    UNION ALL

    -- ZAP, DOWN_ZAP, BOOST from PayIn records (single scan of PayIn)
    SELECT ipi."itemId" AS item_id,
      CASE WHEN pi."payInType" = 'DOWN_ZAP' THEN -1.0 ELSE 1.0 END
        * EXP(EXTRACT(EPOCH FROM pi."payInStateChangedAt") / 14400.0)
        * (pi.mcost::double precision / 1000.0) AS contribution
    FROM "PayIn" pi
    JOIN "ItemPayIn" ipi ON ipi."payInId" = pi.id
    WHERE pi."payInType" IN ('ZAP', 'DOWN_ZAP', 'BOOST')
      AND pi."payInState" = 'PAID'
  ) all_direct
  GROUP BY item_id
) sub
WHERE "Item".id = sub.item_id;

-- Step 2: All ancestor contributions in a single UPDATE
-- Comment ZAPs at 0.25 weight, comment DOWN_ZAPs at 0.1 weight (single scan of PayIn + path join)
UPDATE "Item"
SET rankhot = "Item".rankhot + sub.contribution
FROM (
  SELECT ancestor.id AS ancestor_id,
    SUM(
      CASE WHEN pi."payInType" = 'DOWN_ZAP' THEN -0.1 ELSE 0.25 END
        * EXP(EXTRACT(EPOCH FROM pi."payInStateChangedAt") / 14400.0)
        * (pi.mcost::double precision / 1000.0)
    ) AS contribution
  FROM "PayIn" pi
  JOIN "ItemPayIn" ipi ON ipi."payInId" = pi.id
  JOIN "Item" comment ON comment.id = ipi."itemId" AND comment."parentId" IS NOT NULL
  JOIN "Item" ancestor ON ancestor.path @> comment.path AND ancestor.id <> comment.id
  WHERE pi."payInType" IN ('ZAP', 'DOWN_ZAP')
    AND pi."payInState" = 'PAID'
  GROUP BY ancestor.id
) sub
WHERE "Item".id = sub.ancestor_id;

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
