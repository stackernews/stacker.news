-- Combine item_ranktop + item_rankhot triggers into a single item_ranking trigger
-- that also computes litCenteredSum/litCenteredAt from field deltas (OLD vs NEW),
-- removing the need for explicit litCenteredSum writes in application code.
-- Also inlines the hot_centered_sum_update/hot_centered_at_update helper functions.
-- Renames rankhot -> ranklit, hotCenteredSum -> litCenteredSum, hotCenteredAt -> litCenteredAt.

-- =====================
-- DROP OLD TRIGGERS, FUNCTIONS, AND INDEXES
-- =====================
DROP TRIGGER IF EXISTS item_ranktop ON "Item";
DROP TRIGGER IF EXISTS item_rankhot ON "Item";
DROP FUNCTION IF EXISTS item_ranktop_trigger;
DROP FUNCTION IF EXISTS item_rankhot_trigger;
DROP FUNCTION IF EXISTS hot_centered_sum_update;
DROP FUNCTION IF EXISTS hot_centered_at_update;

DROP INDEX IF EXISTS "Item_rankhot_idx";
DROP INDEX IF EXISTS "Item_subNames_rankhot_idx";

-- =====================
-- RENAME COLUMNS
-- =====================
ALTER TABLE "Item" RENAME COLUMN "rankhot" TO "ranklit";
ALTER TABLE "Item" RENAME COLUMN "hotCenteredSum" TO "litCenteredSum";
ALTER TABLE "Item" RENAME COLUMN "hotCenteredAt" TO "litCenteredAt";

-- =====================
-- CREATE COMBINED RANKING TRIGGER
-- (half-life = 14400 seconds = 4 hours, lambda = ln(2) / 14400)
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
      - (COALESCE(NEW."downMsats", 0) - COALESCE(OLD."downMsats", 0))::double precision / 1000.0
      - (COALESCE(NEW."commentDownMsats", 0) - COALESCE(OLD."commentDownMsats", 0))::double precision * 0.1 / 1000.0
    );
    old_sum := OLD."litCenteredSum";
    old_at := OLD."litCenteredAt";
  END IF;

  -- 3. update litCenteredSum via exponential decay centered at litCenteredAt
  --    all EXP() arguments are <= 0 by construction, so no overflow is possible
  IF w <> 0 THEN
    IF now_epoch >= old_at THEN
      -- decay old sum to now, then add w
      NEW."litCenteredSum" := old_sum * EXP(LN(2) * (old_at - now_epoch) / 14400.0) + w;
    ELSE
      -- old_at is in the future: add w scaled by decay from old_at to now
      NEW."litCenteredSum" := old_sum + w * EXP(LN(2) * (now_epoch - old_at) / 14400.0);
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
  BEFORE INSERT OR UPDATE OF cost, msats, boost, "commentMsats", "downMsats", "commentDownMsats"
  ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_ranking_trigger();

-- =====================
-- RECREATE INDEXES WITH NEW NAMES
-- =====================
CREATE INDEX "Item_ranklit_idx" ON "Item"("ranklit");
CREATE INDEX "Item_subNames_ranklit_idx" ON "Item" USING GIN ("subNames", "ranklit" float8_ops);
