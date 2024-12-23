CREATE OR REPLACE FUNCTION check_daily_sats_summary()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('dailySatSummary', '0 0 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT check_daily_sats_summary();
DROP FUNCTION IF EXISTS check_daily_sats_summary;
