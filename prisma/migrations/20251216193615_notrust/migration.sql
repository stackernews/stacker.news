-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "commentDownMsats" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "downMsats" BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION ranktop_base_exp(
  "msats"              numeric,
  "boost"              numeric,
  "oldBoost"           numeric,
  "commentMsats"       numeric,
  "downMsats"           numeric,
  "commentDownMsats"  numeric
) RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    (
    (COALESCE("msats",0)::double precision
       + (COALESCE("boost",0)::double precision + COALESCE("oldBoost",0)::double precision) * 1000.0
       + COALESCE("commentMsats",0)::double precision * 0.1
      ) * 0.3
      - COALESCE("downMsats",0)::double precision
      - COALESCE("commentDownMsats",0)::double precision * 0.1
    )
$$;

ALTER TABLE "Item"
  ADD COLUMN ranktop double precision GENERATED ALWAYS AS (
    ranktop_base_exp("msats", "boost", "oldBoost", "commentMsats", "downMsats", "commentDownMsats")
  ) STORED NOT NULL;

-- Static exponential ORDER BY key in log-space (H=8h ⇒ λ ≈ 0.086643/h)
ALTER TABLE "Item"
  ADD COLUMN rankhot double precision GENERATED ALWAYS AS (
    CASE
      WHEN ranktop_base_exp("msats", "boost", "oldBoost", "commentMsats", "downMsats", "commentDownMsats") > 0
        THEN LN(ranktop_base_exp("msats", "boost", "oldBoost", "commentMsats", "downMsats", "commentDownMsats")) + 0.086643 * (EXTRACT(EPOCH FROM "Item".created_at) / 3600.0)
      ELSE -1e300
    END
  ) STORED NOT NULL;

CREATE INDEX "Item_ranktop_idx" ON "Item"("ranktop");
CREATE INDEX "Item_rankhot_idx" ON "Item"("rankhot");