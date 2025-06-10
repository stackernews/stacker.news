CREATE OR REPLACE FUNCTION schedule_deleted_user_earnings_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    -- Run at 12:20 AM daily to collect earnings from deleted users and donate to rewards pool
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('deletedUserEarnings', '20 0 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_deleted_user_earnings_job();
DROP FUNCTION IF EXISTS schedule_deleted_user_earnings_job;