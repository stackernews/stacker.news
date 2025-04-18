-- Custom Domain
CREATE TABLE "CustomDomain" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domain" TEXT NOT NULL,
    "subName" CITEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastVerifiedAt" TIMESTAMP(3),
    "verification" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

-- verification jsonb schema
-- {
--     "dns": {
--         "state": "VERIFIED",
--         "cname": "stacker.news",
--         "txt": b64 encoded txt value
--     },
--     "ssl": {
--         "state": "VERIFIED",
--         "cname": acm issued cname,
--         "value": acm issued cname value,
--         "arn": "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"
--     }
-- }

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

-- Custom Branding
CREATE TABLE "CustomBranding" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "colors" JSONB DEFAULT '{}',
    "logoId" INTEGER,
    "faviconId" INTEGER,
    "subName" CITEXT NOT NULL,

    CONSTRAINT "CustomBranding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomBranding_subName_key" ON "CustomBranding"("subName");

-- AddForeignKey
ALTER TABLE "CustomBranding" ADD CONSTRAINT "CustomBranding_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBranding" ADD CONSTRAINT "CustomBranding_faviconId_fkey" FOREIGN KEY ("faviconId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBranding" ADD CONSTRAINT "CustomBranding_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;
