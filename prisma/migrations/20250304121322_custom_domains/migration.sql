-- CreateTable
CREATE TABLE "CustomDomain" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domain" TEXT NOT NULL,
    "subName" CITEXT NOT NULL,
    "dnsState" TEXT,
    "sslState" TEXT,
    "certificateArn" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "verificationCname" TEXT,
    "verificationCnameValue" TEXT,
    "verificationTxt" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT,

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_domain_key" ON "CustomDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_subName_key" ON "CustomDomain"("subName");

-- CreateIndex
CREATE INDEX "CustomDomain_domain_idx" ON "CustomDomain"("domain");

-- CreateIndex
CREATE INDEX "CustomDomain_created_at_idx" ON "CustomDomain"("created_at");

-- AddForeignKey
ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION schedule_domain_verification_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    -- every 10 minutes
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('routineDomainVerification', '*/10 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_domain_verification_job();
DROP FUNCTION IF EXISTS schedule_domain_verification_job;
