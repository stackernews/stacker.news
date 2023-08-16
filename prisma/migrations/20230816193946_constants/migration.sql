-- we don't want to have to update our zap_rank views
-- when constants change. so we'll just make a view that we can update
CREATE OR REPLACE VIEW zap_rank_constants AS
SELECT
5000.0 AS boost_per_vote,
1.2 AS vote_power,
1.3 AS vote_decay,
3.0 AS age_wait_hours,
0.5 AS comment_scaler,
2.2 AS boost_power,
2.6 AS boost_decay,
2100 AS row_limit;

CREATE MATERIALIZED VIEW IF NOT EXISTS zap_rank_wwm_view AS
SELECT id, rank() OVER (ORDER BY
    (
        (GREATEST("weightedVotes", POWER("weightedVotes", vote_power)) + "weightedComments"*comment_scaler)
        /
        POWER(GREATEST(age_wait_hours, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), vote_decay)
        +
        POWER(boost/boost_per_vote, boost_power)
        /
        POWER(GREATEST(age_wait_hours, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), boost_decay)
    ) DESC NULLS LAST, id DESC) AS rank
FROM "Item", zap_rank_constants
WHERE "parentId" IS NULL
AND NOT bio
AND "pinId" IS NULL
AND "deletedAt" IS NULL
AND ("weightedVotes" > 0 OR boost > 0)
ORDER BY rank ASC
LIMIT (SELECT row_limit FROM zap_rank_constants);

CREATE UNIQUE INDEX IF NOT EXISTS zap_rank_wwm_view_idx ON zap_rank_wwm_view(rank ASC);

CREATE MATERIALIZED VIEW IF NOT EXISTS zap_rank_tender_view AS
SELECT id, rank() OVER (ORDER BY
    (
        (GREATEST(ABS("weightedVotes" - "weightedDownVotes"), POWER(ABS("weightedVotes" - "weightedDownVotes"), vote_power)) + "weightedComments"*comment_scaler)
        /
        POWER(GREATEST(age_wait_hours, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), vote_decay)
        +
        POWER(boost/boost_per_vote, boost_power)
        /
        POWER(GREATEST(age_wait_hours, EXTRACT(EPOCH FROM (now_utc() - created_at))/3600), boost_decay)
    ) DESC NULLS LAST, id DESC) AS rank
FROM "Item", zap_rank_constants
WHERE "parentId" IS NULL
AND NOT bio
AND "pinId" IS NULL
AND "deletedAt" IS NULL
AND ("weightedVotes" > "weightedDownVotes" OR boost > 0)
ORDER BY rank ASC
LIMIT (SELECT row_limit FROM zap_rank_constants);

CREATE UNIQUE INDEX IF NOT EXISTS zap_rank_tender_view_idx ON zap_rank_tender_view(rank ASC);