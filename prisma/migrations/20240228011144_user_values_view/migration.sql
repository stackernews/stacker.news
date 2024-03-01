CREATE INDEX IF NOT EXISTS "ItemAct.created_at_hour_index"
    ON "ItemAct"(date_trunc('hour', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "Donation.created_at_day_index"
    ON "Donation"(date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "Item.created_at_day_index"
    ON "Item"(date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "Donation.created_at_hour_index"
    ON "Donation"(date_trunc('hour', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "Item.created_at_hour_index"
    ON "Item"(date_trunc('hour', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));

CREATE OR REPLACE FUNCTION user_values(
    min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT,
    percentile_cutoff INTEGER DEFAULT 33,
    each_upvote_portion FLOAT DEFAULT 4.0,
    each_item_portion FLOAT DEFAULT 4.0,
    handicap_ids INTEGER[] DEFAULT '{616, 6030, 946, 4502}',
    handicap_zap_mult FLOAT DEFAULT 0.2)
RETURNS TABLE (
    t TIMESTAMP(3), id INTEGER, proportion FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, u."userId", u.total_proportion
    FROM generate_series(min, max, ival) period(t),
    LATERAL
        (WITH item_ratios AS (
            SELECT *,
                CASE WHEN "parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type,
                CASE WHEN "weightedVotes" > 0 THEN "weightedVotes"/(sum("weightedVotes") OVER (PARTITION BY "parentId" IS NULL)) ELSE 0 END AS ratio
            FROM (
                SELECT *,
                    NTILE(100)  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS percentile,
                    ROW_NUMBER()  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS rank
                FROM
                    "Item"
                WHERE date_trunc(date_part, created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
                AND "weightedVotes" > 0 AND "deletedAt" IS NULL AND NOT bio
            ) x
            WHERE x.percentile <= percentile_cutoff
        ),
        -- get top upvoters of top posts and comments
        upvoter_islands AS (
            SELECT "ItemAct"."userId", item_ratios.id, item_ratios.ratio, item_ratios."parentId",
                "ItemAct".msats as tipped, "ItemAct".created_at as acted_at,
                ROW_NUMBER() OVER (partition by item_ratios.id order by "ItemAct".created_at asc)
                - ROW_NUMBER() OVER (partition by item_ratios.id, "ItemAct"."userId" order by "ItemAct".created_at asc) AS island
            FROM item_ratios
            JOIN "ItemAct" on "ItemAct"."itemId" = item_ratios.id
            WHERE act = 'TIP' AND date_trunc(date_part, "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
        ),
        -- isolate contiguous upzaps from the same user on the same item so that when we take the log
        -- of the upzaps it accounts for successive zaps and does not disproportionately reward them
        upvoters AS (
            SELECT "userId", upvoter_islands.id, ratio, "parentId", GREATEST(log(sum(tipped) / 1000), 0) as tipped, min(acted_at) as acted_at
            FROM upvoter_islands
            GROUP BY "userId", upvoter_islands.id, ratio, "parentId", island
        ),
        -- the relative contribution of each upvoter to the post/comment
        -- early multiplier: 10/ln(early_rank + e)
        -- we also weight by trust in a step wise fashion
        upvoter_ratios AS (
            SELECT "userId", sum(early_multiplier*tipped_ratio*ratio*CASE WHEN users.id = ANY (handicap_ids) THEN handicap_zap_mult ELSE FLOOR(users.trust*3)+handicap_zap_mult END) as upvoter_ratio,
                "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
            FROM (
                SELECT *,
                    10.0/LN(ROW_NUMBER() OVER (partition by upvoters.id order by acted_at asc) + EXP(1.0)) AS early_multiplier,
                    tipped::float/(sum(tipped) OVER (partition by upvoters.id)) tipped_ratio
                FROM upvoters
                WHERE tipped > 0
            ) u
            JOIN users on "userId" = users.id
            GROUP BY "userId", "parentId" IS NULL
        ),
        proportions AS (
            SELECT "userId", NULL as id, type, ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY upvoter_ratio DESC) as rank,
                upvoter_ratio/(sum(upvoter_ratio) OVER (PARTITION BY "isPost"))/each_upvote_portion as proportion
            FROM upvoter_ratios
            WHERE upvoter_ratio > 0
            UNION ALL
            SELECT "userId", item_ratios.id, type, rank, ratio/each_item_portion as proportion
            FROM item_ratios
        )
        SELECT "userId", sum(proportions.proportion) AS total_proportion
        FROM proportions
        GROUP BY "userId"
        HAVING sum(proportions.proportion) > 0.000001) u;
END;
$$;

CREATE OR REPLACE VIEW today AS
    SELECT date_trunc('day', timezone('America/Chicago', now())) as min,
           date_trunc('day', timezone('America/Chicago', now())) as max;

DROP MATERIALIZED VIEW IF EXISTS user_values_today;
CREATE MATERIALIZED VIEW IF NOT EXISTS user_values_today AS
SELECT (user_values(min, max, '1 day'::INTERVAL, 'day')).* FROM today;

CREATE UNIQUE INDEX IF NOT EXISTS user_values_today_idx ON user_values_today(id);
CREATE INDEX IF NOT EXISTS user_values_today_proportion_idx ON user_values_today(proportion DESC);

DROP MATERIALIZED VIEW IF EXISTS user_values_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS user_values_days AS
SELECT (user_values(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

CREATE UNIQUE INDEX IF NOT EXISTS user_values_days_idx ON user_values_days(t, id);