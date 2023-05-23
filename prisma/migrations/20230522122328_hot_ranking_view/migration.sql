-- basically we want to recreate the frontpage every 5 minutes and avoid the computation
-- on every page load
CREATE MATERIALIZED VIEW IF NOT EXISTS sat_rank_wwm_view AS
SELECT *,
((GREATEST("weightedVotes", POWER("weightedVotes", 1.2)) + "weightedComments"/2)
/
POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), 1.3)
+
(boost/5000::float)
/
POWER(EXTRACT(EPOCH FROM (now_utc() - created_at))/3600+2, 2.6)) AS rank
FROM "Item"
WHERE "parentId" IS NULL AND NOT bio AND "pinId" IS NULL AND "deletedAt" IS NULL
ORDER BY rank DESC NULLS LAST, id DESC;

CREATE UNIQUE INDEX IF NOT EXISTS sat_rank_wwm_view_idx ON sat_rank_wwm_view(id);
CREATE INDEX IF NOT EXISTS sat_rank_wwm_view_subname_idx ON sat_rank_wwm_view("subName");
CREATE INDEX IF NOT EXISTS sat_rank_wwm_view_rank_idx ON sat_rank_wwm_view(rank DESC NULLS LAST, id DESC);

-- we do the same for the tender view
CREATE MATERIALIZED VIEW IF NOT EXISTS sat_rank_tender_view AS
SELECT *,
((GREATEST(ABS("weightedVotes" - "weightedDownVotes"), POWER(ABS("weightedVotes" - "weightedDownVotes"), 1.2))
    + "weightedComments"/2)
/
POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), 1.3)
+
(boost/5000::float)
/
POWER(EXTRACT(EPOCH FROM (now_utc() - created_at))/3600+2, 2.6)) AS rank
FROM "Item"
WHERE "parentId" IS NULL AND NOT bio AND "pinId" IS NULL AND "deletedAt" IS NULL
AND "weightedVotes" > "weightedDownVotes"
ORDER BY rank DESC NULLS LAST, id DESC;

CREATE UNIQUE INDEX IF NOT EXISTS sat_rank_tender_view_idx ON sat_rank_tender_view(id);
CREATE INDEX IF NOT EXISTS sat_rank_tender_view_subname_idx ON sat_rank_tender_view("subName");
CREATE INDEX IF NOT EXISTS sat_rank_tender_view_rank_idx ON sat_rank_tender_view(rank DESC NULLS LAST, id DESC);
