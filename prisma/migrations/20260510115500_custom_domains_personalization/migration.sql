-- CreateTable
CREATE TABLE "SubBranding" (
    "subName" CITEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "linkColor" TEXT,
    "logoId" INTEGER,
    "title" TEXT,
    "tagline" TEXT,
    "faviconId" INTEGER,

    CONSTRAINT "SubBranding_pkey" PRIMARY KEY ("subName")
);

-- CreateIndex
CREATE INDEX "SubBranding_logoId_idx" ON "SubBranding"("logoId");

-- CreateIndex
CREATE INDEX "SubBranding_faviconId_idx" ON "SubBranding"("faviconId");

-- AddForeignKey
ALTER TABLE "SubBranding" ADD CONSTRAINT "SubBranding_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubBranding" ADD CONSTRAINT "SubBranding_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubBranding" ADD CONSTRAINT "SubBranding_faviconId_fkey" FOREIGN KEY ("faviconId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
