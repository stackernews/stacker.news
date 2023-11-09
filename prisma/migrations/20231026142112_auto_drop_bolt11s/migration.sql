-- AlterTable
ALTER TABLE "users" ADD COLUMN "autoDropBolt11s" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Withdrawl" ALTER COLUMN "hash" DROP NOT NULL;
ALTER TABLE "Withdrawl" ALTER COLUMN "bolt11" DROP NOT NULL;

-- hack ... prisma doesn't know about our other schemas (e.g. pgboss)
-- and this is only really a problem on their "shadow database"
-- so we catch the exception it throws and ignore it
CREATE OR REPLACE FUNCTION create_autodrop_bolt11s_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('autoDropBolt11s', '1 1 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT create_autodrop_bolt11s_job();
DROP FUNCTION create_autodrop_bolt11s_job();
