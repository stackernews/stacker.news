CREATE OR REPLACE FUNCTION schedule_this_day_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('thisDay', '0 5 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_this_day_job();
DROP FUNCTION IF EXISTS schedule_this_day_job;