-- our last attempt was slow because nearly every row had to change given
-- that we store the score and all other columns rather than the rank ...
-- the score always changes and other columns are denormalized (and also change) ..
-- if instead we just store the rank, concurrent refreshes should be faster
-- as they'll be near identical
-- we also limit the view to 2100 rows which is more than any reasonable person would view
DROP MATERIALIZED VIEW IF EXISTS sat_rank_wwm_view;
CREATE MATERIALIZED VIEW IF NOT EXISTS sat_rank_wwm_view AS
SELECT id, row_number() OVER (ORDER BY
    ((GREATEST("weightedVotes", POWER("weightedVotes", 1.2)) + "weightedComments"/2)
    /
    POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), 1.3)
    +
    (boost/5000::float)
    /
    POWER(EXTRACT(EPOCH FROM (now_utc() - created_at))/3600+2, 2.6)) DESC NULLS LAST, id DESC) as rank
FROM "Item"
WHERE "parentId" IS NULL AND NOT bio AND "pinId" IS NULL AND "deletedAt" IS NULL
AND "weightedVotes" > 0
ORDER BY
    ((GREATEST("weightedVotes", POWER("weightedVotes", 1.2)) + "weightedComments"/2)
    /
    POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), 1.3)
    +
    (boost/5000::float)
    /
    POWER(EXTRACT(EPOCH FROM (now_utc() - created_at))/3600+2, 2.6)) DESC NULLS LAST, id DESC
LIMIT 2100;

CREATE UNIQUE INDEX IF NOT EXISTS sat_rank_wwm_view_idx ON sat_rank_wwm_view(rank ASC);

-- we do the same for the tender view
DROP MATERIALIZED VIEW IF EXISTS sat_rank_tender_view;
CREATE MATERIALIZED VIEW IF NOT EXISTS sat_rank_tender_view AS
SELECT id, row_number() OVER (ORDER BY
    ((GREATEST(ABS("weightedVotes" - "weightedDownVotes"), POWER(ABS("weightedVotes" - "weightedDownVotes"), 1.2))
        + "weightedComments"/2)
    /
    POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), 1.3)
    +
    (boost/5000::float)
    /
    POWER(EXTRACT(EPOCH FROM (now_utc() - created_at))/3600+2, 2.6)) DESC NULLS LAST, id DESC) AS rank
FROM "Item"
WHERE "parentId" IS NULL AND NOT bio AND "pinId" IS NULL AND "deletedAt" IS NULL
AND "weightedVotes" > "weightedDownVotes"
ORDER BY
    ((GREATEST(ABS("weightedVotes" - "weightedDownVotes"), POWER(ABS("weightedVotes" - "weightedDownVotes"), 1.2))
        + "weightedComments"/2)
    /
    POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), 1.3)
    +
    (boost/5000::float)
    /
    POWER(EXTRACT(EPOCH FROM (now_utc() - created_at))/3600+2, 2.6)) DESC NULLS LAST, id DESC
LIMIT 2100;

CREATE UNIQUE INDEX IF NOT EXISTS sat_rank_tender_view_idx ON sat_rank_tender_view(rank ASC);