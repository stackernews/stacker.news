-- Add commentCost and commentBoost denormalized fields to Item
-- These track the sum of descendant comment costs and boosts (in sats)

-- =====================
-- ADD COLUMNS
-- =====================
ALTER TABLE "Item" ADD COLUMN "commentCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "commentBoost" INTEGER NOT NULL DEFAULT 0;

-- =====================
-- BACKFILL EXISTING DATA
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
-- UPDATE RANKING TRIGGER to include commentCost and commentBoost at 0.25x weight
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

-- Recreate trigger with new column list
DROP TRIGGER IF EXISTS item_ranking ON "Item";
CREATE TRIGGER item_ranking
  BEFORE INSERT OR UPDATE OF cost, msats, boost, "commentMsats", "commentCost", "commentBoost", "downMsats", "commentDownMsats"
  ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_ranking_trigger();
