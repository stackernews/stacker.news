-- CreateTable
CREATE TABLE "CustomBranding" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
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
