CREATE OR REPLACE FUNCTION sub_stats(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), sub_name CITEXT, comments BIGINT, posts BIGINT,
    msats_revenue BIGINT, msats_stacked BIGINT, msats_spent BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t,
        "subName" as sub_name,
        (sum(quantity) FILTER (WHERE type = 'COMMENT'))::BIGINT as comments,
        (sum(quantity) FILTER (WHERE type = 'POST'))::BIGINT as posts,
        (sum(quantity) FILTER (WHERE type = 'REVENUE'))::BIGINT as msats_revenue,
        (sum(quantity) FILTER (WHERE type = 'TIP'))::BIGINT as msats_stacked,
        (sum(quantity) FILTER (WHERE type IN ('BOOST', 'TIP', 'FEE', 'STREAM', 'POLL', 'DONT_LIKE_THIS', 'VOTE')))::BIGINT as msats_spent
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN (
        -- For msats_spent and msats_stacked
        (SELECT "subName", "ItemAct"."msats" as quantity, act::TEXT as type, "ItemAct"."created_at"
            FROM "ItemAct"
            JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
            WHERE "ItemAct"."created_at" >= min_utc
                AND "subName" IS NOT NULL
                AND act = 'TIP')
            UNION ALL
        (SELECT "subName", 1 as quantity, 'POST' as type, created_at
            FROM "Item"
            WHERE created_at >= min_utc
                AND "Item"."parentId" IS NULL
                AND "subName" IS NOT NULL)
            UNION ALL
        (SELECT root."subName", 1 as quantity, 'COMMENT' as type, "Item"."created_at"
            FROM "Item"
            JOIN "Item" root ON "Item"."rootId" = root."id"
            WHERE "Item"."created_at" >= min_utc
                AND root."subName" IS NOT NULL)
            UNION ALL
        -- For msats_revenue
        (SELECT "subName", msats as quantity, type::TEXT as type, created_at
            FROM "SubAct"
            WHERE created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY "subName", period.t
    ORDER BY period.t ASC;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS sub_stats_hours;
CREATE MATERIALIZED VIEW IF NOT EXISTS sub_stats_hours AS
SELECT (sub_stats(min, max, '1 hour'::INTERVAL, 'hour')).* FROM last_24_hours;

DROP MATERIALIZED VIEW IF EXISTS sub_stats_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS sub_stats_days AS
SELECT (sub_stats(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

DROP MATERIALIZED VIEW IF EXISTS sub_stats_months;
CREATE MATERIALIZED VIEW IF NOT EXISTS sub_stats_months AS
SELECT (sub_stats(min, max, '1 month'::INTERVAL, 'month')).* FROM all_months;

CREATE UNIQUE INDEX IF NOT EXISTS sub_stats_hours_idx ON sub_stats_hours(t, sub_name);
CREATE UNIQUE INDEX IF NOT EXISTS sub_stats_days_idx ON sub_stats_days(t, sub_name);
CREATE UNIQUE INDEX IF NOT EXISTS sub_stats_months_idx ON sub_stats_months(t, sub_name);
