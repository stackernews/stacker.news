-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "pollExpiresAt" TIMESTAMP(3);

UPDATE "Item"
SET "pollExpiresAt" = "created_at" + interval '1 day'
WHERE "pollCost" IS NOT NULL;
