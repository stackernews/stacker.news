-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'ACTIVE', 'HOLD');

-- CreateEnum
CREATE TYPE "DomainVerificationType" AS ENUM ('TXT', 'CNAME', 'SSL');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "DomainCertificateStatus" AS ENUM ('PENDING_VALIDATION', 'ISSUED', 'INACTIVE', 'EXPIRED', 'REVOKED', 'FAILED', 'VALIDATION_TIMED_OUT');

-- CreateTable
CREATE TABLE "Domain" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainName" CITEXT NOT NULL,
    "subName" CITEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainVerificationAttempt" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainId" INTEGER NOT NULL,
    "verificationRecordId" INTEGER NOT NULL,
    "status" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,

    CONSTRAINT "DomainVerificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainVerificationRecord" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "domainId" INTEGER NOT NULL,
    "type" "DomainVerificationType" NOT NULL,
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
