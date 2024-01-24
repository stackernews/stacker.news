-- fix posts empty in user stats
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
        (sum(quantity) FILTER (WHERE type = 'POST'))::BIGINT as posts,
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

REFRESH MATERIALIZED VIEW user_stats_hours;
REFRESH MATERIALIZED VIEW user_stats_days;
REFRESH MATERIALIZED VIEW user_stats_months;
