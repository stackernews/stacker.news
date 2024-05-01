CREATE OR REPLACE FUNCTION reschedule_earn_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule set cron = '0 0 * * *' WHERE name = 'earn';
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT reschedule_earn_job();
DROP FUNCTION IF EXISTS reschedule_earn_job;