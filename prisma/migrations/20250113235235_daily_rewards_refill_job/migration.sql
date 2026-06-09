CREATE OR REPLACE FUNCTION schedule_daily_rewards_refill_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    -- 10 minutes after midnight
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('earnRefill', '10 0 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_daily_rewards_refill_job();
DROP FUNCTION IF EXISTS schedule_daily_rewards_refill_job;
