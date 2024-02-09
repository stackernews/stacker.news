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
        coalesce(floor(sum(msats) FILTER (WHERE act NOT IN ('BOOST', 'TIP', 'STREAM', 'DONATION', 'TERRITORY'))/1000), 0)::BIGINT as fees,
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

REFRESH MATERIALIZED VIEW CONCURRENTLY spending_growth_hours;
REFRESH MATERIALIZED VIEW CONCURRENTLY spending_growth_days;
REFRESH MATERIALIZED VIEW CONCURRENTLY spending_growth_months;