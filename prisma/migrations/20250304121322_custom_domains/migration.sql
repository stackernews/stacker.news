-- CreateTable
CREATE TABLE "CustomDomain" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domain" TEXT NOT NULL,
    "subName" CITEXT NOT NULL,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sslCertExpiry" TIMESTAMP(3),
    "verificationState" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),

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
