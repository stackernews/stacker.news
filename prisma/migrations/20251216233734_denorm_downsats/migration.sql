-- for all downzaps, denormalize the downMsats and commentDownMsats of ancestors
WITH downzaps AS (
    UPDATE "Item"
    SET "downMsats" = subquery."downMsats"
    FROM (
        SELECT "ItemPayIn"."itemId" AS "itemId", SUM("PayIn".mcost) AS "downMsats"
        FROM "ItemPayIn"
        JOIN "PayIn" ON "PayIn"."id" = "ItemPayIn"."payInId"
        WHERE "PayIn"."payInType" = 'DOWN_ZAP'
        AND "PayIn"."payInState" = 'PAID'
        GROUP BY "ItemPayIn"."itemId"
    ) subquery
    WHERE "Item"."id" = subquery."itemId"
    RETURNING "Item".*
)
UPDATE "Item"
SET "commentDownMsats" = subquery."commentDownMsats"
FROM (
    SELECT b.id AS "itemId", SUM(a."downMsats") AS "commentDownMsats"
    FROM downzaps a
    JOIN "Item" b ON b.path <@ a.path AND a.id <> b.id
    GROUP BY b.id
) subquery
WHERE "Item"."id" = subquery."itemId";