-- AlterTable
ALTER TABLE "Item" ADD COLUMN "nDirectComments" INTEGER NOT NULL DEFAULT 0;

-- Update nDirectComments
UPDATE "Item"
SET "nDirectComments" = "DirectComments"."nDirectComments"
FROM (
    SELECT "Item"."parentId" AS "id", COUNT(*) AS "nDirectComments"
    FROM "Item"
    WHERE "Item"."parentId" IS NOT NULL
    GROUP BY "Item"."parentId"
) AS "DirectComments"
WHERE "Item"."id" = "DirectComments"."id";