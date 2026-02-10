-- Evergreen Ranking Refactor
-- 1. Drop STORED generated columns (rankhot, ranktop, rankboost)
-- 2. Drop old SQL functions (rankhot_sort_key, ranktop_sort_key)
-- 3. Re-add as regular columns
-- 4. Create BEFORE triggers for ranktop and rankboost
-- 5. Backfill ranktop, rankboost, and rankhot
-- 6. Recreate indexes

-- =====================
-- DROP INDEXES (must drop before dropping columns)
-- =====================
DROP INDEX IF EXISTS "Item_ranktop_idx";
DROP INDEX IF EXISTS "Item_rankhot_idx";
DROP INDEX IF EXISTS "Item_rankboost_idx";
DROP INDEX IF EXISTS "Item_subNames_ranktop_idx";
DROP INDEX IF EXISTS "Item_subNames_rankhot_idx";
DROP INDEX IF EXISTS "Item_subNames_rankboost_idx";

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
-- RE-ADD AS REGULAR COLUMNS
-- =====================
ALTER TABLE "Item" ADD COLUMN "ranktop" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "rankhot" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "rankboost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- =====================
-- CREATE TRIGGER FOR ranktop
-- =====================
CREATE OR REPLACE FUNCTION item_ranktop_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.ranktop := (
    (COALESCE(NEW.msats, 0)::double precision
      + (COALESCE(NEW.boost, 0)::double precision + COALESCE(NEW."oldBoost", 0)::double precision) * 1000.0
      + COALESCE(NEW."commentMsats", 0)::double precision * 0.25
    ) * 0.3
    - COALESCE(NEW."downMsats", 0)::double precision
    - COALESCE(NEW."commentDownMsats", 0)::double precision * 0.1
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER item_ranktop
  BEFORE INSERT OR UPDATE OF msats, boost, "oldBoost", "commentMsats", "downMsats", "commentDownMsats" ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_ranktop_trigger();

-- =====================
-- CREATE TRIGGER FOR rankboost
-- =====================
CREATE OR REPLACE FUNCTION item_rankboost_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.rankboost := COALESCE(NEW.boost, 0)::double precision * 1000.0 * 0.3
    - COALESCE(NEW."downMsats", 0)::double precision;
  RETURN NEW;
END;
$$;

CREATE TRIGGER item_rankboost
  BEFORE INSERT OR UPDATE OF boost, "downMsats" ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_rankboost_trigger();

-- =====================
-- BACKFILL ranktop and rankboost
-- (triggers don't fire for UPDATE ... SET col = col, so we compute directly)
-- =====================
UPDATE "Item"
SET
  "ranktop" = (
    (COALESCE(msats, 0)::double precision
      + (COALESCE(boost, 0)::double precision + COALESCE("oldBoost", 0)::double precision) * 1000.0
      + COALESCE("commentMsats", 0)::double precision * 0.25
    ) * 0.3
    - COALESCE("downMsats", 0)::double precision
    - COALESCE("commentDownMsats", 0)::double precision * 0.1
  ),
  "rankboost" = COALESCE(boost, 0)::double precision * 1000.0 * 0.3
    - COALESCE("downMsats", 0)::double precision;

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
-- RECREATE INDEXES
-- =====================
CREATE INDEX "Item_ranktop_idx" ON "Item"("ranktop");
CREATE INDEX "Item_rankhot_idx" ON "Item"("rankhot");
CREATE INDEX "Item_rankboost_idx" ON "Item"("rankboost");
CREATE INDEX "Item_subNames_ranktop_idx" ON "Item" USING GIN ("subNames", "ranktop" float8_ops);
CREATE INDEX "Item_subNames_rankhot_idx" ON "Item" USING GIN ("subNames", "rankhot" float8_ops);
CREATE INDEX "Item_subNames_rankboost_idx" ON "Item" USING GIN ("subNames", "rankboost" float8_ops);
