CREATE EXTENSION IF NOT EXISTS ip4r;

-- CreateTable
CREATE TABLE "OFAC" (
    "id" SERIAL NOT NULL,
    "startIP" ipaddress NOT NULL,
    "endIP" ipaddress NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,

    CONSTRAINT "OFAC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OFAC_start_ip_end_ip_idx" ON "OFAC" USING GIST (iprange("startIP", "endIP"));

CREATE OR REPLACE FUNCTION create_ofac_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('ofac', '0 3 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT create_ofac_job();
DROP FUNCTION create_ofac_job();