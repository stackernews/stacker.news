WITH RECURSIVE base AS (
    SELECT "Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
        "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path") AS "path",
            ARRAY[row_number() OVER (ORDER BY (x.sats-1)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "Item".created_at))/3600+2, 1.5) DESC NULLS LAST, "Item"."path")] AS sort_path
    FROM "Item"
    LEFT JOIN (SELECT i.id, SUM("Vote".sats) as sats
        FROM "Item" i
        JOIN "Vote" ON i.id = "Vote"."itemId"
        WHERE i."parentId" IS NULL
        GROUP BY i.id) x ON "Item".id = x.id
    WHERE "parentId" IS NULL
  UNION ALL
    SELECT "Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
        "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path") AS "path",
            p.sort_path || row_number() OVER (ORDER BY (x.sats-1)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "Item".created_at))/3600+2, 1.5) DESC NULLS LAST, "Item"."path")
    FROM base p
    JOIN "Item" ON ltree2text(subpath("Item"."path", 0, -1)) = p."path"
    LEFT JOIN (SELECT i.id, SUM("Vote".sats) as sats
    FROM "Item" i
    JOIN "Vote" ON i.id = "Vote"."itemId"
    WHERE i."parentId" IS NULL
    GROUP BY i.id) x ON "Item".id = x.id
)
select * from base order by sort_path;

WITH RECURSIVE base AS (
    SELECT "Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
        "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path") AS "path",
            ARRAY[row_number() OVER (ORDER BY "Item".created_at, "Item"."path")] AS sort_path
    FROM "Item"
    WHERE "parentId" IS NULL
  UNION ALL
    SELECT "Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
        "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path") AS "path",
            p.sort_path || row_number() OVER (ORDER BY "Item".created_at, "Item"."path")
    FROM base p
    JOIN "Item" ON ltree2text(subpath("Item"."path", 0, -1)) = p."path"
)
select * from base order by sort_path;