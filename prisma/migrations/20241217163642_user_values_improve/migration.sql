CREATE OR REPLACE FUNCTION user_values(
    min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT,
    percentile_cutoff INTEGER DEFAULT 50,
    each_upvote_portion FLOAT DEFAULT 4.0,
    each_item_portion FLOAT DEFAULT 4.0,
    handicap_ids INTEGER[] DEFAULT '{616, 6030, 4502, 27}',
    handicap_zap_mult FLOAT DEFAULT 0.3)
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
                AND "weightedVotes" > 0
                AND "deletedAt" IS NULL
                AND NOT bio
                AND ("invoiceActionState" IS NULL OR "invoiceActionState" = 'PAID')
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
            WHERE act = 'TIP'
            AND date_trunc(date_part, "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
            AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
        ),
        -- isolate contiguous upzaps from the same user on the same item so that when we take the log
        -- of the upzaps it accounts for successive zaps and does not disproportionately reward them
        -- quad root of the total tipped
        upvoters AS (
            SELECT "userId", upvoter_islands.id, ratio, "parentId", GREATEST(power(sum(tipped) / 1000, 0.25), 0) as tipped, min(acted_at) as acted_at
            FROM upvoter_islands
            GROUP BY "userId", upvoter_islands.id, ratio, "parentId", island
        ),
        -- the relative contribution of each upvoter to the post/comment
        -- early component: 1/ln(early_rank + e - 1)
        -- tipped component: how much they tipped relative to the total tipped for the item
        -- multiplied by the relative rank of the item to the total items
        -- multiplied by the trust of the user
        upvoter_ratios AS (
            SELECT "userId", sum((early_multiplier+tipped_ratio)*ratio*CASE WHEN users.id = ANY (handicap_ids) THEN handicap_zap_mult ELSE users.trust+0.1 END) as upvoter_ratio,
                "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
            FROM (
                SELECT *,
                    1.0/LN(ROW_NUMBER() OVER (partition by upvoters.id order by acted_at asc) + EXP(1.0) - 1) AS early_multiplier,
                    tipped::float/(sum(tipped) OVER (partition by upvoters.id)) tipped_ratio
                FROM upvoters
                WHERE tipped > 2.1
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