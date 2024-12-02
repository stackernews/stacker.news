-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "embedMeta" JSONB;

-- CreateTable
CREATE TABLE "EmbedMeta" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "meta" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbedMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEmbedMeta" (
    "itemId" INTEGER NOT NULL,
    "embedId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemEmbedMeta_pkey" PRIMARY KEY ("itemId","embedId","provider")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmbedMeta_id_provider_key" ON "EmbedMeta"("id", "provider");

-- CreateIndex
CREATE INDEX "ItemEmbedMeta.created_at_index" ON "ItemEmbedMeta"("created_at");

-- AddForeignKey
ALTER TABLE "ItemEmbedMeta" ADD CONSTRAINT "ItemEmbedMeta_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEmbedMeta" ADD CONSTRAINT "ItemEmbedMeta_embedId_provider_fkey" FOREIGN KEY ("embedId", "provider") REFERENCES "EmbedMeta"("id", "provider") ON DELETE CASCADE ON UPDATE CASCADE;

-- Denormalize embedMeta into Item
CREATE OR REPLACE FUNCTION update_item_embed_meta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Item"
  SET "embedMeta" = (
    SELECT jsonb_object_agg(em."id", em."meta")
    FROM "ItemEmbedMeta" iem
    JOIN "EmbedMeta" em ON iem."embedId" = em."id" AND iem."provider" = em."provider"
    WHERE iem."itemId" = NEW."itemId"
  )
  WHERE "id" = NEW."itemId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_embed_meta_trigger
AFTER INSERT OR UPDATE OR DELETE ON "ItemEmbedMeta"
FOR EACH ROW
EXECUTE FUNCTION update_item_embed_meta();


-- Delete unused embeds
CREATE OR REPLACE FUNCTION cleanup_embed_meta()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ItemEmbedMeta"
    WHERE "embedId" = OLD."embedId" AND "provider" = OLD."provider"
  ) THEN
    DELETE FROM "EmbedMeta"
    WHERE "id" = OLD."embedId" AND "provider" = OLD."provider";
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_embed_meta_trigger
AFTER DELETE ON "ItemEmbedMeta"
FOR EACH ROW
EXECUTE FUNCTION cleanup_embed_meta();