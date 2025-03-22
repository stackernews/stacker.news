CREATE OR REPLACE VIEW hot_score_constants AS
 SELECT 10000.0 AS boost_per_vote,
    1.0 AS vote_power,
    1.1 AS vote_decay,
    3 AS age_wait_hours,
    0.25 AS comment_vote_scaler;

CREATE MATERIALIZED VIEW IF NOT EXISTS hot_score_view_temp AS
  SELECT id,
         CASE WHEN "Item"."weightedVotes" - "Item"."weightedDownVotes" > 0
            THEN (POWER("Item"."weightedVotes" - "Item"."weightedDownVotes", hot_score_constants.vote_power)
                + "Item"."weightedComments"*hot_score_constants.comment_vote_scaler
                + "Item".boost / hot_score_constants.boost_per_vote)
                / POWER(GREATEST(hot_score_constants.age_wait_hours, EXTRACT(EPOCH FROM (now() - "Item".created_at))/3600), hot_score_constants.vote_decay)
            ELSE "Item"."weightedVotes" - "Item"."weightedDownVotes" END AS hot_score,
         CASE WHEN "Item"."subWeightedVotes" - "Item"."subWeightedDownVotes" > 0
            THEN (POWER("Item"."subWeightedVotes" - "Item"."subWeightedDownVotes", hot_score_constants.vote_power)
                + "Item"."weightedComments"*hot_score_constants.comment_vote_scaler
                + "Item".boost / hot_score_constants.boost_per_vote)
                / POWER(GREATEST(hot_score_constants.age_wait_hours, EXTRACT(EPOCH FROM (now() - "Item".created_at))/3600), hot_score_constants.vote_decay)
            ELSE "Item"."subWeightedVotes" - "Item"."subWeightedDownVotes" END AS sub_hot_score
  FROM "Item", hot_score_constants
  WHERE "Item"."weightedVotes" > 0 OR "Item"."weightedDownVotes" > 0 OR "Item"."subWeightedVotes" > 0
    OR "Item"."subWeightedDownVotes" > 0 OR "Item"."weightedComments" > 0 OR "Item".boost > 0;

DROP MATERIALIZED VIEW IF EXISTS hot_score_view;
ALTER MATERIALIZED VIEW hot_score_view_temp RENAME TO hot_score_view;

CREATE UNIQUE INDEX IF NOT EXISTS hot_score_view_id_idx ON hot_score_view(id);
CREATE INDEX IF NOT EXISTS hot_score_view_hot_score_idx ON hot_score_view(hot_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS hot_score_view_sub_hot_score_idx ON hot_score_view(sub_hot_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS hot_score_view_hot_score_no_nulls_idx ON hot_score_view(hot_score DESC);
CREATE INDEX IF NOT EXISTS hot_score_view_sub_hot_score_no_nulls_idx ON hot_score_view(sub_hot_score DESC);


