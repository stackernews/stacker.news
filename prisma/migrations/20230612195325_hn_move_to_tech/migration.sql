UPDATE "Item"
SET "subName" = 'tech'
WHERE "Item"."parentId" IS NULL
AND "Item"."userId" = 13361; -- hn user id