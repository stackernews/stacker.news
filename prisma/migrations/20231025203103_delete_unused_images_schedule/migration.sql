-- add 'deleteUnusedImages' job to the prisma hack
-- see migration 20230522153900_schedule_jobs
CREATE OR REPLACE FUNCTION create_scheduled_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('trust', '0 2 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('auction', '* * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('earn', '0 0 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('streak', '15 0 * * *','America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('views', '0 0 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('rankViews', '* * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('rankViews', '* * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('deleteUnusedImages', '* * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT create_scheduled_jobs();