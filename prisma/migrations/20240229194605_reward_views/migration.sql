CREATE OR REPLACE FUNCTION rewards(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), total BIGINT, donations BIGINT, fees BIGINT, boost BIGINT, jobs BIGINT, anons_stack BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    RETURN QUERY
    SELECT period.t,
        coalesce(FLOOR(sum(msats)), 0)::BIGINT as total,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type = 'DONATION')), 0)::BIGINT as donations,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type NOT IN ('BOOST', 'STREAM', 'DONATION', 'ANON'))), 0)::BIGINT as fees,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type = 'BOOST')), 0)::BIGINT as boost,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type = 'STREAM')), 0)::BIGINT as jobs,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type = 'ANON')), 0)::BIGINT as anons_stack
    FROM generate_series(min, max, ival) period(t),
    LATERAL
    (
        (SELECT
            ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) * COALESCE("Sub"."rewardsPct", 100) * 0.01  as msats,
            act::text as type
          FROM "ItemAct"
          JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
          LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName"
          LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
          WHERE date_trunc(date_part, "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
            AND "ItemAct".act <> 'TIP')
          UNION ALL
        (SELECT sats * 1000 as msats, 'DONATION' as type
          FROM "Donation"
          WHERE date_trunc(date_part, "Donation".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t)
          UNION ALL
        -- any earnings from anon's stack that are not forwarded to other users
        (SELECT "ItemAct".msats, 'ANON' as type
          FROM "Item"
          JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
          LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id
          WHERE "Item"."userId" = 27 AND "ItemAct".act = 'TIP'
          AND date_trunc(date_part, "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
          GROUP BY "ItemAct".id, "ItemAct".msats
          HAVING COUNT("ItemForward".id) = 0)
    ) x
    GROUP BY period.t;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS rewards_today;
CREATE MATERIALIZED VIEW IF NOT EXISTS rewards_today AS
SELECT (rewards(min, max, '1 day'::INTERVAL, 'day')).* FROM today;

DROP MATERIALIZED VIEW IF EXISTS rewards_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS rewards_days AS
SELECT (rewards(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

CREATE UNIQUE INDEX IF NOT EXISTS rewards_today_idx ON rewards_today(t);
CREATE UNIQUE INDEX IF NOT EXISTS rewards_days_idx ON rewards_days(t);

CREATE OR REPLACE FUNCTION reschedule_earn_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule set cron = '10 0 1 * *' WHERE name = 'earn';
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT reschedule_earn_job();
DROP FUNCTION IF EXISTS reschedule_earn_job;