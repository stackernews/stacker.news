CREATE OR REPLACE FUNCTION schedule_territory_revenue()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('territoryRevenue', '0 0 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_territory_revenue();
DROP FUNCTION IF EXISTS create_territory_billing_job;
