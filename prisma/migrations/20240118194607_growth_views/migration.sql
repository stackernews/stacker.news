-- all hours for the last day
CREATE OR REPLACE VIEW last_24_hours AS
    SELECT date_trunc('hour', timezone('America/Chicago', now() - interval '24 hours')) as min,
           date_trunc('hour', timezone('America/Chicago', now() - interval '1 hour')) as max;

-- all days since launch
CREATE OR REPLACE VIEW all_days AS
    SELECT date_trunc('day', timezone('America/Chicago', '2021-06-01')) as min,
           date_trunc('day', timezone('America/Chicago', now() - interval '1 day')) as max;

CREATE OR REPLACE VIEW all_months AS
    SELECT date_trunc('month', timezone('America/Chicago', '2021-06-01')) as min,
           date_trunc('month', timezone('America/Chicago', now() - interval '1 month')) as max;

-- get registrations
CREATE OR REPLACE FUNCTION reg_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), referrals BIGINT, organic BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, count("referrerId") as referrals,
        count(users.id) FILTER(WHERE id > 616) - count("inviteId") as organic
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN users ON period.t = date_trunc(date_part, timezone('America/Chicago', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'))
    GROUP BY period.t
    ORDER BY period.t ASC;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS reg_growth_hours;
CREATE MATERIALIZED VIEW IF NOT EXISTS reg_growth_hours AS
SELECT (reg_growth(min, max, '1 hour'::INTERVAL, 'hour')).* FROM last_24_hours;

DROP MATERIALIZED VIEW IF EXISTS reg_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS reg_growth_days AS
SELECT (reg_growth(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

DROP MATERIALIZED VIEW IF EXISTS reg_growth_months;
CREATE MATERIALIZED VIEW IF NOT EXISTS reg_growth_months AS
SELECT (reg_growth(min, max, '1 month'::INTERVAL, 'month')).* FROM all_months;

-- get spenders
CREATE OR REPLACE FUNCTION spender_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), "userId" INT, type TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, u."userId", u.type
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "ItemAct".created_at, "ItemAct"."userId", act::text as type
        FROM "ItemAct"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, "Donation"."userId", 'DONATION' as type
        FROM "Donation"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, "SubAct"."userId", 'TERRITORY' as type
            FROM "SubAct"
            WHERE "SubAct".type = 'BILLING'
            AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t, u."userId", u.type
    ORDER BY period.t ASC;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS spender_growth_hours;
CREATE MATERIALIZED VIEW IF NOT EXISTS spender_growth_hours AS
SELECT (spender_growth(min, max, '1 hour'::INTERVAL, 'hour')).* FROM last_24_hours;

DROP MATERIALIZED VIEW IF EXISTS spender_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS spender_growth_days AS
SELECT (spender_growth(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

DROP MATERIALIZED VIEW IF EXISTS spender_growth_months;
CREATE MATERIALIZED VIEW IF NOT EXISTS spender_growth_months AS
SELECT (spender_growth(min, max, '1 month'::INTERVAL, 'month')).* FROM all_months;

-- get items
CREATE OR REPLACE FUNCTION item_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), comments BIGINT, jobs BIGINT, posts BIGINT, territories BIGINT, zaps BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, count(*) FILTER (WHERE type = 'COMMENT') as comments,
            count(*) FILTER (WHERE type = 'JOB') as jobs,
            count(*) FILTER (WHERE type = 'POST') as posts,
            count(*) FILTER (WHERE type = 'TERRITORY') as territories,
            count(*) FILTER (WHERE type = 'ZAP') as zaps
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT created_at,
        CASE
            WHEN "subName" = 'jobs' THEN 'JOB'
            WHEN "parentId" IS NULL THEN 'POST'
            ELSE 'COMMENT' END as type
    FROM "Item"
    WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, 'TERRITORY' as type
    FROM "Sub"
    WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, 'ZAP' as type
    FROM "ItemAct"
    WHERE act = 'TIP'
    AND created_at >= min_utc)) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t
    ORDER BY period.t ASC;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS item_growth_hours;
CREATE MATERIALIZED VIEW IF NOT EXISTS item_growth_hours AS
SELECT (item_growth(min, max, '1 hour'::INTERVAL, 'hour')).* FROM last_24_hours;

DROP MATERIALIZED VIEW IF EXISTS item_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS item_growth_days AS
SELECT (item_growth(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

DROP MATERIALIZED VIEW IF EXISTS item_growth_months;
CREATE MATERIALIZED VIEW IF NOT EXISTS item_growth_months AS
SELECT (item_growth(min, max, '1 month'::INTERVAL, 'month')).* FROM all_months;

-- get spending
CREATE OR REPLACE FUNCTION spending_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), jobs BIGINT, boost BIGINT, fees BIGINT, tips BIGINT, donations BIGINT, territories BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'STREAM')/1000), 0)::BIGINT as jobs,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'BOOST')/1000), 0)::BIGINT as boost,
        coalesce(floor(sum(msats) FILTER (WHERE act NOT IN ('BOOST', 'TIP', 'STREAM', 'DONATION'))/1000), 0)::BIGINT as fees,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'TIP')/1000), 0)::BIGINT as tips,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'DONATION')/1000), 0)::BIGINT as donations,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'TERRITORY')/1000), 0)::BIGINT as territories
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "ItemAct".created_at, msats, act::text as act
        FROM "ItemAct"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, sats * 1000 as msats, 'DONATION' as act
        FROM "Donation"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, msats, 'TERRITORY' as act
        FROM "SubAct"
        WHERE type = 'BILLING'
        AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t
    ORDER BY period.t ASC;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS spending_growth_hours;
CREATE MATERIALIZED VIEW IF NOT EXISTS spending_growth_hours AS
SELECT (spending_growth(min, max, '1 hour'::INTERVAL, 'hour')).* FROM last_24_hours;

DROP MATERIALIZED VIEW IF EXISTS spending_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS spending_growth_days AS
SELECT (spending_growth(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

DROP MATERIALIZED VIEW IF EXISTS spending_growth_months;
CREATE MATERIALIZED VIEW IF NOT EXISTS spending_growth_months AS
SELECT (spending_growth(min, max, '1 month'::INTERVAL, 'month')).* FROM all_months;

-- get stackers
CREATE OR REPLACE FUNCTION stackers_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), "userId" INT, type TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, u."userId", u.type
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "ItemAct".created_at, "Item"."userId", CASE WHEN "Item"."parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc)
    UNION ALL
    (SELECT created_at, "Earn"."userId", 'EARN' as type
        FROM "Earn"
        WHERE created_at >= min_utc)
    UNION ALL
        (SELECT created_at, "ReferralAct"."referrerId" as "userId", 'REFERRAL' as type
        FROM "ReferralAct"
        WHERE created_at >= min_utc)
    UNION ALL
        (SELECT created_at, "SubAct"."userId", 'REVENUE' as type
            FROM "SubAct"
            WHERE "SubAct".type = 'REVENUE'
            AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t, u."userId", u.type
    ORDER BY period.t ASC;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS stackers_growth_hours;
CREATE MATERIALIZED VIEW IF NOT EXISTS stackers_growth_hours AS
SELECT (stackers_growth(min, max, '1 hour'::INTERVAL, 'hour')).* FROM last_24_hours;

DROP MATERIALIZED VIEW IF EXISTS stackers_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS stackers_growth_days AS
SELECT (stackers_growth(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

DROP MATERIALIZED VIEW IF EXISTS stackers_growth_months;
CREATE MATERIALIZED VIEW IF NOT EXISTS stackers_growth_months AS
SELECT (stackers_growth(min, max, '1 month'::INTERVAL, 'month')).* FROM all_months;

-- get stacking
CREATE OR REPLACE FUNCTION stacking_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), rewards BIGINT, posts BIGINT, comments BIGINT, referrals BIGINT, territories BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t,
        coalesce(floor(sum(airdrop)/1000),0)::BIGINT as rewards,
        coalesce(floor(sum(post)/1000),0)::BIGINT as posts,
        coalesce(floor(sum(comment)/1000),0)::BIGINT as comments,
        coalesce(floor(sum(referral)/1000),0)::BIGINT as referrals,
        coalesce(floor(sum(revenue)/1000),0)::BIGINT as territories
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "ItemAct".created_at, 0 as airdrop,
        CASE WHEN "Item"."parentId" IS NULL THEN 0 ELSE "ItemAct".msats END as comment,
        CASE WHEN "Item"."parentId" IS NULL THEN "ItemAct".msats ELSE 0 END as post,
        0 as referral,
        0 as revenue
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc)
    UNION ALL
    (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, msats as referral, 0 as revenue
        FROM "ReferralAct"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, msats as airdrop, 0 as post, 0 as comment, 0 as referral, 0 as revenue
        FROM "Earn"
        WHERE created_at >= min_utc)
    UNION ALL
        (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, 0 as referral, msats as revenue
            FROM "SubAct"
            WHERE type = 'REVENUE'
            AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t
    ORDER BY period.t ASC;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS stacking_growth_hours;
CREATE MATERIALIZED VIEW IF NOT EXISTS stacking_growth_hours AS
SELECT (stacking_growth(min, max, '1 hour'::INTERVAL, 'hour')).* FROM last_24_hours;

DROP MATERIALIZED VIEW IF EXISTS stacking_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS stacking_growth_days AS
SELECT (stacking_growth(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

DROP MATERIALIZED VIEW IF EXISTS stacking_growth_months;
CREATE MATERIALIZED VIEW IF NOT EXISTS stacking_growth_months AS
SELECT (stacking_growth(min, max, '1 month'::INTERVAL, 'month')).* FROM all_months;


-- for user top stats
CREATE OR REPLACE FUNCTION user_stats(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), id INTEGER, comments BIGINT, posts BIGINT, territories BIGINT,
    referrals BIGINT, msats_tipped BIGINT, msats_rewards BIGINT, msats_referrals BIGINT,
    msats_revenue BIGINT, msats_stacked BIGINT, msats_fees BIGINT, msats_donated BIGINT,
    msats_billing BIGINT, msats_spent BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t,
        "userId" as id,
        -- counts
        (sum(quantity) FILTER (WHERE type = 'COMMENT'))::BIGINT as comments,
        (sum(quantity) FILTER (WHERE type = 'POSTS'))::BIGINT as posts,
        (sum(quantity) FILTER (WHERE type = 'TERRITORY'))::BIGINT as territories,
        (sum(quantity) FILTER (WHERE type = 'REFERRAL'))::BIGINT as referrals,
        -- stacking
        (sum(quantity) FILTER (WHERE type = 'TIPPEE'))::BIGINT as msats_tipped,
        (sum(quantity) FILTER (WHERE type = 'EARN'))::BIGINT as msats_rewards,
        (sum(quantity) FILTER (WHERE type = 'REFERRAL_ACT'))::BIGINT as msats_referrals,
        (sum(quantity) FILTER (WHERE type = 'REVENUE'))::BIGINT as msats_revenue,
        (sum(quantity) FILTER (WHERE type IN ('TIPPEE', 'EARN', 'REFERRAL_ACT', 'REVENUE')))::BIGINT as msats_stacked,
        -- spending
        (sum(quantity) FILTER (WHERE type IN ('BOOST', 'TIP', 'FEE', 'STREAM', 'POLL', 'DONT_LIKE_THIS')))::BIGINT as msats_fees,
        (sum(quantity) FILTER (WHERE type = 'DONATION'))::BIGINT as msats_donated,
        (sum(quantity) FILTER (WHERE type = 'TERRITORY'))::BIGINT as msats_billing,
        (sum(quantity) FILTER (WHERE type IN ('BOOST', 'TIP', 'FEE', 'STREAM', 'POLL', 'DONT_LIKE_THIS', 'DONATION', 'TERRITORY')))::BIGINT as msats_spent
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "userId", msats as quantity, act::TEXT as type, created_at
        FROM "ItemAct"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "userId", sats*1000 as quantity, 'DONATION' as type, created_at
        FROM "Donation"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "userId", 1 as quantity,
        CASE WHEN "Item"."parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type, created_at
        FROM "Item"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "referrerId" as "userId", 1 as quantity, 'REFERRAL' as type, created_at
        FROM users
        WHERE "referrerId" IS NOT NULL
        AND created_at >= min_utc)
        UNION ALL
    -- tips accounting for forwarding
    (SELECT "Item"."userId", floor("ItemAct".msats * (1-COALESCE(sum("ItemForward".pct)/100.0, 0))) as quantity, 'TIPPEE' as type, "ItemAct".created_at
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        LEFT JOIN "ItemForward" on "ItemForward"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc
        GROUP BY "Item"."userId", "ItemAct".id, "ItemAct".msats, "ItemAct".created_at)
        UNION ALL
    -- tips where stacker is a forwardee
    (SELECT "ItemForward"."userId", floor("ItemAct".msats*("ItemForward".pct/100.0)) as quantity, 'TIPPEE' as type, "ItemAct".created_at
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        JOIN "ItemForward" on "ItemForward"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc)
        UNION ALL
    (SELECT "userId", msats as quantity, 'EARN' as type, created_at
        FROM "Earn"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "referrerId" as "userId", msats as quantity, 'REFERRAL_ACT' as type, created_at
        FROM "ReferralAct"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "userId", msats as quantity, type::TEXT as type, created_at
        FROM "SubAct"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "userId", 1 as quantity, 'TERRITORY' as type, created_at
        FROM "Sub"
        WHERE status <> 'STOPPED'
        AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY "userId", period.t
    ORDER BY period.t ASC;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS user_stats_hours;
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats_hours AS
SELECT (user_stats(min, max, '1 hour'::INTERVAL, 'hour')).* FROM last_24_hours;

DROP MATERIALIZED VIEW IF EXISTS user_stats_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats_days AS
SELECT (user_stats(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

DROP MATERIALIZED VIEW IF EXISTS user_stats_months;
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats_months AS
SELECT (user_stats(min, max, '1 month'::INTERVAL, 'month')).* FROM all_months;

-- indices on hours
CREATE UNIQUE INDEX IF NOT EXISTS user_stats_hours_idx ON user_stats_hours(t, id);
CREATE UNIQUE INDEX IF NOT EXISTS reg_growth_hours_idx ON reg_growth_hours(t);
CREATE UNIQUE INDEX IF NOT EXISTS spender_growth_hours_idx ON spender_growth_hours(t, "userId", type);
CREATE UNIQUE INDEX IF NOT EXISTS item_growth_hour_idx ON item_growth_hours(t);
CREATE UNIQUE INDEX IF NOT EXISTS spending_growth_hours_idx ON spending_growth_hours(t);
CREATE UNIQUE INDEX IF NOT EXISTS stackers_growth_hours_idx ON stackers_growth_hours(t, "userId", type);
CREATE UNIQUE INDEX IF NOT EXISTS stacking_growth_hours_idx ON stacking_growth_hours(t);

-- indices on days
CREATE UNIQUE INDEX IF NOT EXISTS user_stats_days_idx ON user_stats_days(t, id);
CREATE UNIQUE INDEX IF NOT EXISTS reg_growth_days_idx ON reg_growth_days(t);
CREATE UNIQUE INDEX IF NOT EXISTS spender_growth_days_idx ON spender_growth_days(t, "userId", type);
CREATE UNIQUE INDEX IF NOT EXISTS item_growth_days_idx ON item_growth_days(t);
CREATE UNIQUE INDEX IF NOT EXISTS spending_growth_days_idx ON spending_growth_days(t);
CREATE UNIQUE INDEX IF NOT EXISTS stackers_growth_days_idx ON stackers_growth_days(t, "userId", type);
CREATE UNIQUE INDEX IF NOT EXISTS stacking_growth_days_idx ON stacking_growth_days(t);

-- indices on months
CREATE UNIQUE INDEX IF NOT EXISTS user_stats_months_idx ON user_stats_months(t, id);
CREATE UNIQUE INDEX IF NOT EXISTS reg_growth_months_idx ON reg_growth_months(t);
CREATE UNIQUE INDEX IF NOT EXISTS spender_growth_months_idx ON spender_growth_months(t, "userId", type);
CREATE UNIQUE INDEX IF NOT EXISTS item_growth_months_idx ON item_growth_months(t);
CREATE UNIQUE INDEX IF NOT EXISTS spending_growth_months_idx ON spending_growth_months(t);
CREATE UNIQUE INDEX IF NOT EXISTS stackers_growth_months_idx ON stackers_growth_months(t, "userId", type);
CREATE UNIQUE INDEX IF NOT EXISTS stacking_growth_months_idx ON stacking_growth_months(t);

CREATE OR REPLACE FUNCTION create_period_views_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule SET name = 'views-days', data = json_build_object('period', 'days') WHERE name = 'views';
    INSERT INTO pgboss.schedule (name, data, cron, timezone)
    VALUES ('views-hours', json_build_object('period', 'hours'), '0 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, data, cron, timezone)
    VALUES ('views-months', json_build_object('period', 'months'), '0 0 1 * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT create_period_views_job();
DROP FUNCTION create_period_views_job();


