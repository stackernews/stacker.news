-- CreateEnum
CREATE TYPE "DomainVerificationType" AS ENUM ('TXT', 'CNAME', 'SSL');

-- CreateTable
CREATE TABLE "Domain" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainName" CITEXT NOT NULL,
    "subName" CITEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainVerification" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainId" INTEGER NOT NULL,
    "type" "DomainVerificationType" NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "host" CITEXT,
    "value" TEXT,
    "sslArn" TEXT,
    "result" TEXT,
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "DomainVerification_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "DomainVerification_domainId_idx" ON "DomainVerification"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainVerification_domainId_type_key" ON "DomainVerification"("domainId", "type");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainVerification" ADD CONSTRAINT "DomainVerification_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
