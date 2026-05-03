ALTER TABLE "Domain"
ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- bump tokenVersion on any domain state transition
CREATE OR REPLACE FUNCTION bump_domain_token_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW."tokenVersion" = OLD."tokenVersion" + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bump_domain_token_version
BEFORE UPDATE ON "Domain"
FOR EACH ROW
WHEN (
     (NEW.status = 'ACTIVE' AND OLD.status IS DISTINCT FROM 'ACTIVE')
  OR (OLD.status = 'ACTIVE' AND NEW.status IS DISTINCT FROM 'ACTIVE')
)
EXECUTE FUNCTION bump_domain_token_version();

-- periodic DNS drift check for ACTIVE domains, every 5 minutes
CREATE OR REPLACE FUNCTION schedule_check_active_domains_dns()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('checkActiveDomainsDNS', '*/5 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_check_active_domains_dns();
DROP FUNCTION IF EXISTS schedule_check_active_domains_dns;
