-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "subNames" CITEXT[];

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
        WHERE "ItemSub"."itemId" = NEW."itemId") subquery
    WHERE "Item"."id" = NEW."itemId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "denormalize_subnames_trigger"
ON INSERT OR UPDATE ON "ItemSub"
FOR EACH ROW EXECUTE FUNCTION denormalize_subnames();

CREATE EXTENSION IF NOT EXISTS btree_gin;

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_subName_fkey";

-- DropIndex
DROP INDEX "Item.subName_index";

-- DropIndex
DROP INDEX "Item_subName_created_at_idx";

-- DropIndex
DROP INDEX "Item_subName_rankboost_idx";

-- DropIndex
DROP INDEX "Item_subName_rankhot_idx";

-- DropIndex
DROP INDEX "Item_subName_ranktop_idx";

-- CreateIndex
CREATE INDEX "ItemSub_itemId_idx" ON "ItemSub"("itemId");

-- CreateIndex
CREATE INDEX "ItemSub_subName_idx" ON "ItemSub"("subName");

-- CreateIndex
CREATE INDEX "ItemSub_created_at_idx" ON "ItemSub"("created_at");

-- CreateIndex
CREATE INDEX "Item_subNames_idx" ON "Item" USING GIN ("subNames");

-- CreateIndex
CREATE INDEX "Item_subNames_created_at_idx" ON "Item" USING GIN ("subNames", "created_at");

-- CreateIndex
CREATE INDEX "Item_subNames_ranktop_idx" ON "Item" USING GIN ("subNames", "ranktop");

-- CreateIndex
CREATE INDEX "Item_subNames_rankhot_idx" ON "Item" USING GIN ("subNames", "rankhot");

-- CreateIndex
CREATE INDEX "Item_subNames_rankboost_idx" ON "Item" USING GIN ("subNames", "rankboost");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSub" ADD CONSTRAINT "ItemSub_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSub" ADD CONSTRAINT "ItemSub_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;
