-- CreateTable
CREATE TABLE "Embed" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Embed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEmbed" (
    "itemId" INTEGER NOT NULL,
    "embedId" INTEGER NOT NULL,

    CONSTRAINT "ItemEmbed_pkey" PRIMARY KEY ("itemId","embedId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Embed_provider_providerId_key" ON "Embed"("provider", "providerId");

-- CreateIndex
CREATE INDEX "ItemEmbed_embedId_idx" ON "ItemEmbed"("embedId");

-- AddForeignKey
ALTER TABLE "ItemEmbed" ADD CONSTRAINT "ItemEmbed_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEmbed" ADD CONSTRAINT "ItemEmbed_embedId_fkey" FOREIGN KEY ("embedId") REFERENCES "Embed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

