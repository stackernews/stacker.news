-- the idea is that we refresh these every day after midnight texas time
-- then anything but days doesn't need to be compute from scatch

-- all days since the beginning of founding
CREATE OR REPLACE VIEW days AS
WITH range_values AS (
    SELECT date_trunc('day', '2021-06-07'::timestamp) as minval,
           date_trunc('day', timezone('America/Chicago', now() - interval '1 day')) as maxval)
    SELECT generate_series(minval, maxval, interval '1 day') as day
    FROM range_values;

-- get registrations
CREATE MATERIALIZED VIEW IF NOT EXISTS reg_growth_days AS
SELECT day, count("referrerId") as referrals,
    count(users.id) FILTER(WHERE id > 616) - count("inviteId") as organic
FROM days
LEFT JOIN users ON day = date_trunc('day', timezone('America/Chicago', created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- get spenders
CREATE MATERIALIZED VIEW IF NOT EXISTS spender_growth_days AS
SELECT day, count(DISTINCT "userId") as any,
            count(DISTINCT "userId") FILTER (WHERE act = 'STREAM') as jobs,
            count(DISTINCT "userId") FILTER (WHERE act = 'BOOST') as boost,
            count(DISTINCT "userId") FILTER (WHERE act = 'FEE') as fees,
            count(DISTINCT "userId") FILTER (WHERE act = 'TIP') as tips,
            count(DISTINCT "userId") FILTER (WHERE act = 'DONATION') as donations
FROM days
LEFT JOIN
((SELECT "ItemAct".created_at, "userId", act::text as act
    FROM "ItemAct")
UNION ALL
(SELECT created_at, "userId", 'DONATION' as act
    FROM "Donation")) u ON day = date_trunc('day', timezone('America/Chicago', u.created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- get items
CREATE MATERIALIZED VIEW IF NOT EXISTS item_growth_days AS
SELECT day, count("parentId") as comments,
            count("subName") FILTER (WHERE "subName" = 'jobs') as jobs,
            count(id) FILTER (WHERE "parentId" IS NULL AND "subName" <> 'jobs') as posts
FROM days
LEFT JOIN "Item" ON day = date_trunc('day', timezone('America/Chicago', created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- get spending
CREATE MATERIALIZED VIEW IF NOT EXISTS spending_growth_days AS
SELECT day, coalesce(floor(sum(msats) FILTER (WHERE act = 'STREAM')/1000), 0) as jobs,
            coalesce(floor(sum(msats) FILTER (WHERE act = 'BOOST')/1000), 0) as boost,
            coalesce(floor(sum(msats) FILTER (WHERE act NOT IN ('BOOST', 'TIP', 'STREAM', 'DONATION'))/1000), 0) as fees,
            coalesce(floor(sum(msats) FILTER (WHERE act = 'TIP')/1000), 0) as tips,
            coalesce(floor(sum(msats) FILTER (WHERE act = 'DONATION')/1000), 0) as donations
FROM days
LEFT JOIN
((SELECT "ItemAct".created_at, msats, act::text as act
    FROM "ItemAct")
UNION ALL
(SELECT created_at, sats * 1000 as msats, 'DONATION' as act
    FROM "Donation")) u ON day = date_trunc('day', timezone('America/Chicago', u.created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- get stackers
CREATE MATERIALIZED VIEW IF NOT EXISTS stackers_growth_days AS
SELECT day, count(distinct user_id) as any,
            count(distinct user_id) FILTER (WHERE type = 'POST') as posts,
            count(distinct user_id) FILTER (WHERE type = 'COMMENT') as comments,
            count(distinct user_id) FILTER (WHERE type = 'EARN') as rewards,
            count(distinct user_id) FILTER (WHERE type = 'REFERRAL') as referrals
FROM days
LEFT JOIN
((SELECT "ItemAct".created_at, "Item"."userId" as user_id, CASE WHEN "Item"."parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type
    FROM "ItemAct"
    JOIN "Item" on "ItemAct"."itemId" = "Item".id
    WHERE "ItemAct".act = 'TIP')
UNION ALL
(SELECT created_at, "userId" as user_id, 'EARN' as type
    FROM "Earn")
UNION ALL
    (SELECT created_at, "referrerId" as user_id, 'REFERRAL' as type
    FROM "ReferralAct")) u ON day = date_trunc('day', timezone('America/Chicago', u.created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- get stacking
CREATE MATERIALIZED VIEW IF NOT EXISTS stacking_growth_days AS
SELECT day, coalesce(floor(sum(airdrop)/1000),0) as rewards,
            coalesce(floor(sum(post)/1000),0) as posts,
            coalesce(floor(sum(comment)/1000),0) as comments,
            coalesce(floor(sum(referral)/1000),0) as referrals
FROM days
LEFT JOIN
((SELECT "ItemAct".created_at, 0 as airdrop,
    CASE WHEN "Item"."parentId" IS NULL THEN 0 ELSE "ItemAct".msats END as comment,
    CASE WHEN "Item"."parentId" IS NULL THEN "ItemAct".msats ELSE 0 END as post,
    0 as referral
    FROM "ItemAct"
    JOIN "Item" on "ItemAct"."itemId" = "Item".id
    WHERE "ItemAct".act = 'TIP')
UNION ALL
    (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, msats as referral
    FROM "ReferralAct")
UNION ALL
(SELECT created_at, msats as airdrop, 0 as post, 0 as comment, 0 as referral
    FROM "Earn")) u ON day = date_trunc('day', timezone('America/Chicago', u.created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;


