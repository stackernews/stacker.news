-- AlterTable
ALTER TABLE "Item" ADD COLUMN "subNames" CITEXT[];

-- CreateTable
CREATE TABLE "ItemSub" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "subName" CITEXT NOT NULL,

    CONSTRAINT "ItemSub_pkey" PRIMARY KEY ("itemId","subName")
);

CREATE FUNCTION denormalize_subnames() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "Item" SET "subNames" = subquery."subNames"
    FROM (
        SELECT ARRAY_AGG("subName") AS "subNames"
        FROM "ItemSub"
        WHERE "ItemSub"."itemId" = COALESCE(NEW."itemId", OLD."itemId")
    ) subquery
    WHERE "Item"."id" = COALESCE(NEW."itemId", OLD."itemId");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "denormalize_subnames_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ItemSub"
FOR EACH ROW EXECUTE FUNCTION denormalize_subnames();

-- migrate old subnames to ItemSub
INSERT INTO "ItemSub" ("itemId", "subName") SELECT "id", "subName" FROM "Item" WHERE "subName" IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS btree_gin;

-- can't use subName in the unique time constraint anymore
ALTER TABLE "Item" DROP CONSTRAINT "Item_unique_time_constraint";
ALTER TABLE "Item" ADD CONSTRAINT "Item_unique_time_constraint"
  EXCLUDE USING gist (
    "userId" WITH =,
    COALESCE("parentId", -1) WITH =,
    md5(COALESCE("title", '')) WITH =,
    md5(COALESCE("text", '')) WITH =,
    tsrange(created_at, created_at + INTERVAL '10 minutes') WITH &&
  )
  WHERE (created_at > '2024-12-30' AND "deletedAt" IS NULL);

-- Drop column
ALTER TABLE "Item" DROP COLUMN "subName";

-- CreateIndex
CREATE INDEX "ItemSub_itemId_idx" ON "ItemSub"("itemId");

-- CreateIndex
CREATE INDEX "ItemSub_subName_idx" ON "ItemSub"("subName");

-- CreateIndex
CREATE INDEX "ItemSub_created_at_idx" ON "ItemSub"("created_at");

-- CreateIndex
CREATE INDEX "Item_subNames_idx" ON "Item" USING GIN ("subNames");

-- CreateIndex
CREATE INDEX "Item_subNames_created_at_idx" ON "Item" USING GIN ("subNames", "created_at" timestamp_ops);

-- CreateIndex
CREATE INDEX "Item_subNames_ranktop_idx" ON "Item" USING GIN ("subNames", "ranktop" float8_ops);

-- CreateIndex
CREATE INDEX "Item_subNames_rankhot_idx" ON "Item" USING GIN ("subNames", "rankhot" float8_ops);

-- CreateIndex
CREATE INDEX "Item_subNames_rankboost_idx" ON "Item" USING GIN ("subNames", "rankboost" float8_ops);

-- AddForeignKey
ALTER TABLE "ItemSub" ADD CONSTRAINT "ItemSub_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSub" ADD CONSTRAINT "ItemSub_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;
