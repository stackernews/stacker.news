-- AlterTable
ALTER TABLE "Item" ADD COLUMN "cost" INTEGER NOT NULL DEFAULT 0;

-- use existing "ItemAct".act = FEE AND "Item"."userId" = "ItemAct"."userId" to calculate the cost for existing "Item"s
UPDATE "Item" SET "cost" = "ItemAct"."msats" / 1000
FROM "ItemAct"
WHERE "Item"."id" = "ItemAct"."itemId" AND "ItemAct"."act" = 'FEE' AND "Item"."userId" = "ItemAct"."userId";

ALTER TABLE "users" ADD COLUMN "investmentFilter" INTEGER NOT NULL DEFAULT 10;

UPDATE "users" SET "investmentFilter" = 0 WHERE "greeterMode";

ALTER TABLE "users" DROP COLUMN "greeterMode";