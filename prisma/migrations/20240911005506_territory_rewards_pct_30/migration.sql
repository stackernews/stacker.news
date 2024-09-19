UPDATE "Sub" SET "rewardsPct" = 30;

-- account for comments in rewards
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
          LEFT JOIN "Item" root ON "Item"."rootId" = root.id
          JOIN "Sub" ON "Sub"."name" = COALESCE(root."subName", "Item"."subName")
          LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
          WHERE date_trunc(date_part, "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
            AND "ItemAct".act <> 'TIP'
            AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
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
          AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
          GROUP BY "ItemAct".id, "ItemAct".msats
          HAVING COUNT("ItemForward".id) = 0)
    ) x
    GROUP BY period.t;
END;
$$;