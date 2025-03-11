CREATE OR REPLACE FUNCTION schedule_domain_verification_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    -- every 5 minutes
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('domainVerification', '*/5 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_domain_verification_job();
DROP FUNCTION IF EXISTS schedule_domain_verification_job;