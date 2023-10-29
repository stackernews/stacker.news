-- AlterTable
ALTER TABLE "users" ADD COLUMN "autoDropWdInvoices" BOOLEAN NOT NULL DEFAULT false;

-- hack ... prisma doesn't know about our other schemas (e.g. pgboss)
-- and this is only really a problem on their "shadow database"
-- so we catch the exception it throws and ignore it
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
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('autoDropWdInvoices', '* * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT create_scheduled_jobs();
