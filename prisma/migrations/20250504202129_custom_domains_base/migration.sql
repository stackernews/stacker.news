-- CreateEnum
CREATE TYPE "DomainVerificationStage" AS ENUM ('GENERAL', 'CNAME', 'ACM_REQUEST_CERTIFICATE', 'ACM_REQUEST_VALIDATION_VALUES', 'ACM_VALIDATION', 'ELB_ATTACH_CERTIFICATE', 'VERIFICATION_COMPLETE');

-- CreateEnum
CREATE TYPE "DomainRecordType" AS ENUM ('CNAME', 'SSL');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'ACTIVE', 'HOLD');

-- CreateEnum
CREATE TYPE "DomainCertificateStatus" AS ENUM ('PENDING_VALIDATION', 'ISSUED', 'INACTIVE', 'EXPIRED', 'REVOKED', 'FAILED', 'VALIDATION_TIMED_OUT');

-- CreateTable
CREATE TABLE "Domain" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainName" CITEXT NOT NULL,
    "subName" CITEXT NOT NULL,
    "status" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainVerificationAttempt" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainId" INTEGER NOT NULL,
    "verificationRecordId" INTEGER,
    "stage" "DomainVerificationStage" NOT NULL DEFAULT 'GENERAL',
    "status" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,

    CONSTRAINT "DomainVerificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainVerificationRecord" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_checked_at" TIMESTAMP(3),
    "domainId" INTEGER NOT NULL,
    "type" "DomainRecordType" NOT NULL,
    "recordName" TEXT NOT NULL,
    "recordValue" TEXT NOT NULL,
    "status" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "DomainVerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainCertificate" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainId" INTEGER NOT NULL,
    "certificateArn" TEXT NOT NULL,
    "status" "DomainCertificateStatus" NOT NULL,

    CONSTRAINT "DomainCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_domainName_key" ON "Domain"("domainName");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_subName_key" ON "Domain"("subName");

-- CreateIndex
CREATE INDEX "Domain_domainName_idx" ON "Domain"("domainName");

-- CreateIndex
CREATE INDEX "Domain_created_at_idx" ON "Domain"("created_at");

-- CreateIndex
CREATE INDEX "Domain_subName_idx" ON "Domain"("subName");

-- CreateIndex
CREATE INDEX "DomainVerificationAttempt_domainId_idx" ON "DomainVerificationAttempt"("domainId");

-- CreateIndex
CREATE INDEX "DomainVerificationAttempt_verificationRecordId_idx" ON "DomainVerificationAttempt"("verificationRecordId");

-- CreateIndex
CREATE INDEX "DomainVerificationRecord_domainId_idx" ON "DomainVerificationRecord"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainVerificationRecord_domainId_type_recordName_key" ON "DomainVerificationRecord"("domainId", "type", "recordName");

-- CreateIndex
CREATE UNIQUE INDEX "DomainCertificate_certificateArn_key" ON "DomainCertificate"("certificateArn");

-- CreateIndex
CREATE UNIQUE INDEX "DomainCertificate_domainId_key" ON "DomainCertificate"("domainId");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainVerificationAttempt" ADD CONSTRAINT "DomainVerificationAttempt_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainVerificationAttempt" ADD CONSTRAINT "DomainVerificationAttempt_verificationRecordId_fkey" FOREIGN KEY ("verificationRecordId") REFERENCES "DomainVerificationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainVerificationRecord" ADD CONSTRAINT "DomainVerificationRecord_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainCertificate" ADD CONSTRAINT "DomainCertificate_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Clear domains that have been on HOLD for 30 days or more every midnight.
CREATE OR REPLACE FUNCTION schedule_clear_long_held_domains()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('clearLongHeldDomains', '0 0 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_clear_long_held_domains();
DROP FUNCTION IF EXISTS schedule_clear_long_held_domains;

-- Update the record status from the attempt
CREATE OR REPLACE FUNCTION update_record_status_from_attempt()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "DomainVerificationRecord"
  SET status = NEW.status,
      last_checked_at = NEW.created_at
  WHERE id = NEW."verificationRecordId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_record_status
AFTER INSERT ON "DomainVerificationAttempt"
FOR EACH ROW
EXECUTE FUNCTION update_record_status_from_attempt();

-- SCENARIO: Territory got stopped after grace period
-- HOLD the domain when the sub is stopped
-- this is to prevent the domain from being used by another sub;
-- won't delete anything but it will require a new verification attempt if the sub is resumed
CREATE OR REPLACE FUNCTION hold_domain_on_sub_stop()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Domain" SET "status" = 'HOLD' WHERE "subName" = NEW.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hold_domain_on_sub_stop
AFTER UPDATE ON "Sub"
FOR EACH ROW
WHEN (NEW.status = 'STOPPED')
EXECUTE FUNCTION hold_domain_on_sub_stop();

-- SCENARIO: Territory got taken over by a different user
-- clear the domain when the sub is taken over by a different user;
-- this will delete the domain, its certificates, verification attempts, DNS records and brandings.
-- will also trigger a request to ACM to delete the certificate because the domain is being deleted
CREATE OR REPLACE FUNCTION clear_domain_on_sub_takeover()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM "Domain" WHERE "subName" = NEW.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clear_domain_on_sub_takeover
AFTER UPDATE ON "Sub"
FOR EACH ROW
WHEN (NEW."userId" != OLD."userId")
EXECUTE FUNCTION clear_domain_on_sub_takeover();

-- ask ACM to delete the certificate
CREATE OR REPLACE FUNCTION ask_acm_to_delete_certificate()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pgboss.job (name, data, retrylimit, retrydelay)
    VALUES (
      'deleteDomainCertificate',
      jsonb_build_object('certificateArn', OLD."certificateArn"),
      3, -- retry 3 times on ACM errors
      60*60 -- wait 1 hour between retries
    ) ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- everytime a domain (relation) or a domainCertificate is deleted, also ask ACM to delete the certificate
CREATE TRIGGER trigger_ask_acm_to_delete_certificate
AFTER DELETE ON "DomainCertificate"
FOR EACH ROW
WHEN (OLD."certificateArn" IS NOT NULL)
EXECUTE FUNCTION ask_acm_to_delete_certificate();
