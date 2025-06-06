-- CreateTable
CREATE TABLE "SubBranding" (
    "id" SERIAL NOT NULL,
    "subName" CITEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "logoId" INTEGER,
    "faviconId" INTEGER,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,

    CONSTRAINT "SubBranding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubBranding_subName_key" ON "SubBranding"("subName");

-- CreateIndex
CREATE INDEX "SubBranding_subName_idx" ON "SubBranding"("subName");

-- AddForeignKey
ALTER TABLE "SubBranding" ADD CONSTRAINT "SubBranding_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubBranding" ADD CONSTRAINT "SubBranding_faviconId_fkey" FOREIGN KEY ("faviconId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubBranding" ADD CONSTRAINT "SubBranding_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;
