-- add referrals to user stats and more fields while we're at it
DROP FUNCTION IF EXISTS user_stats(timestamp without time zone,timestamp without time zone,interval,text) CASCADE;
CREATE OR REPLACE FUNCTION user_stats(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), id INTEGER, comments BIGINT, posts BIGINT, territories BIGINT,
    referrals BIGINT, one_day_referrals BIGINT, msats_tipped BIGINT, msats_rewards BIGINT,
    msats_referrals BIGINT, msats_one_day_referrals BIGINT,
    msats_revenue BIGINT, msats_stacked BIGINT, msats_fees BIGINT, msats_donated BIGINT,
    msats_billing BIGINT, msats_zaps BIGINT, msats_spent BIGINT)
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
        (sum(quantity) FILTER (WHERE type = 'POST'))::BIGINT as posts,
        (sum(quantity) FILTER (WHERE type = 'TERRITORY'))::BIGINT as territories,
        (sum(quantity) FILTER (WHERE type = 'REFERRAL'))::BIGINT as referrals,
        (sum(quantity) FILTER (WHERE type = 'ONE_DAY_REFERRAL_COUNT'))::BIGINT as one_day_referrals,
        -- stacking
        (sum(quantity) FILTER (WHERE type = 'TIPPEE'))::BIGINT as msats_tipped,
        (sum(quantity) FILTER (WHERE type = 'EARN'))::BIGINT as msats_rewards,
        (sum(quantity) FILTER (WHERE type = 'REFERRAL_ACT' OR type = 'FOREVER_REFERRAL'))::BIGINT as msats_referrals,
        (sum(quantity) FILTER (WHERE type = 'ONE_DAY_REFERRAL'))::BIGINT as msats_one_day_referrals,
        (sum(quantity) FILTER (WHERE type = 'REVENUE'))::BIGINT as msats_revenue,
        (sum(quantity) FILTER (WHERE type IN ('TIPPEE', 'EARN', 'REFERRAL_ACT', 'REVENUE', 'ONE_DAY_REFERRAL', 'FOREVER_REFERRAL')))::BIGINT as msats_stacked,
        -- spending
        (sum(quantity) FILTER (WHERE type IN ('BOOST', 'FEE', 'STREAM', 'POLL', 'DONT_LIKE_THIS')))::BIGINT as msats_fees,
        (sum(quantity) FILTER (WHERE type = 'DONATION'))::BIGINT as msats_donated,
        (sum(quantity) FILTER (WHERE type = 'BILLING'))::BIGINT as msats_billing,
        (sum(quantity) FILTER (WHERE type = 'TIP'))::BIGINT as msats_zaps,
        (sum(quantity) FILTER (WHERE type IN ('BOOST', 'TIP', 'FEE', 'STREAM', 'POLL', 'DONT_LIKE_THIS', 'DONATION', 'BILLING')))::BIGINT as msats_spent
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "userId", msats as quantity, act::TEXT as type, created_at
        FROM "ItemAct"
        WHERE created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
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
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
        GROUP BY "Item"."userId", "ItemAct".id, "ItemAct".msats, "ItemAct".created_at)
        UNION ALL
    -- tips where stacker is a forwardee
    (SELECT "ItemForward"."userId", floor("ItemAct".msats*("ItemForward".pct/100.0)) as quantity, 'TIPPEE' as type, "ItemAct".created_at
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        JOIN "ItemForward" on "ItemForward"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
        UNION ALL
    (SELECT "userId", msats as quantity, 'EARN' as type, created_at
        FROM "Earn"
        WHERE (type is NULL OR type NOT IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL'))
        AND created_at >= min_utc)
        UNION ALL
    (SELECT "userId", msats as quantity, type::TEXT as type, created_at
        FROM "Earn"
        WHERE type IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL')
        AND created_at >= min_utc)
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
        UNION ALL
    -- for every referree, get the one day referrer on each day
    (SELECT mode() WITHIN GROUP (ORDER BY "OneDayReferral"."referrerId") AS "userId", 1 as quantity,
        'ONE_DAY_REFERRAL_COUNT' as type, max(created_at) AS created_at
        FROM "OneDayReferral"
        WHERE created_at >= min_utc
        GROUP BY "refereeId", date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
        HAVING mode() WITHIN GROUP (ORDER BY "OneDayReferral"."referrerId") IS NOT NULL)
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

CREATE UNIQUE INDEX IF NOT EXISTS user_stats_months_idx ON user_stats_months(t, id);
CREATE UNIQUE INDEX IF NOT EXISTS user_stats_days_idx ON user_stats_days(t, id);
CREATE UNIQUE INDEX IF NOT EXISTS user_stats_hours_idx ON user_stats_hours(t, id);

DROP FUNCTION IF EXISTS earn(user_id INTEGER, earn_msats BIGINT, created_at TIMESTAMP(3),
    type "EarnType", type_id INTEGER, rank INTEGER);

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
        AND "ItemAct".created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
    UNION ALL
    (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, msats as referral, 0 as revenue
        FROM "ReferralAct"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, msats as airdrop, 0 as post, 0 as comment, 0 as referral, 0 as revenue
        FROM "Earn"
        WHERE ("Earn".type is NULL OR "Earn".type NOT IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL'))
        AND created_at >= min_utc)
    UNION ALL
    (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, msats as referral, 0 as revenue
        FROM "Earn"
        WHERE "Earn".type IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL')
        AND created_at >= min_utc)
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
        AND "ItemAct".created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
    UNION ALL
    (SELECT created_at, "Earn"."userId", 'EARN' as type
        FROM "Earn"
        WHERE ("Earn".type is NULL OR "Earn".type NOT IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL'))
        AND created_at >= min_utc)
    UNION ALL
        (SELECT created_at, "ReferralAct"."referrerId" as "userId", 'REFERRAL' as type
        FROM "ReferralAct"
        WHERE created_at >= min_utc)
     UNION ALL
    (SELECT created_at, "Earn"."userId", 'REFERRAL' as type
        FROM "Earn"
        WHERE "Earn".type IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL')
        AND created_at >= min_utc)
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