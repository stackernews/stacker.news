CREATE OR REPLACE FUNCTION genoutlawed_state(
  "weightedVotes"      double precision,
  "weightedDownVotes"  double precision,
  "outlawed"           boolean,
  "created_at"         timestamp(3),
  "msats"              numeric,
  "downMsats"          numeric,
  "boost"              numeric,
  "oldBoost"           numeric
) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT "outlawed"
  OR (
    "created_at" < '2025-12-20 00:00:00'::timestamp(3)
    AND "weightedVotes" - "weightedDownVotes" <= -1.2)
  OR (
    (COALESCE("msats", 0)
        + (COALESCE("boost", 0) + COALESCE("oldBoost", 0)) * 1000.0
    ) * 0.3 - COALESCE("downMsats", 0) <= -1000000)
$$;

-- trigger a regeneration of the genoutlawed column
UPDATE "Item" SET outlawed = outlawed WHERE created_at >= '2025-12-20 00:00:00'::timestamp(3);