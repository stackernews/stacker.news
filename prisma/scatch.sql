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

CREATE OR REPLACE FUNCTION vote(item_id INTEGER, username TEXT, vote_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER
    user_sats INTEGER
BEGIN
    SELECT sats, id INTO user_sats, user_id FROM "User" WHERE name = username;
    IF vote_sats > user_sats THEN
        RAISE EXCEPTION 'insufficient funds';
    END IF;

    UPDATE "User" SET sats = sats - vote_sats WHERE id = user_id;

    IF EXISTS (SELECT 1 FROM "Vote" WHERE "itemId" = item_id AND "userId" = user_id) THEN
        INSERT INTO "Vote" (sats, "itemId", "userId") VALUES (vote_sats, item_id, user_id);
        UPDATE "User" SET sats = sats + vote_sats WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);
    ELSE
        INSERT INTO "Vote" (sats, "itemId", "userId", boost) VALUES (vote_sats, item_id, user_id, true);
    END IF;

    RETURN sats
END;
$$;