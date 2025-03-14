-- exclude posts in own subs from spam detection
CREATE OR REPLACE FUNCTION item_spam(parent_id INTEGER, user_id INTEGER, within INTERVAL, subName TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    repeats INTEGER;
    self_replies INTEGER;
BEGIN
    -- no fee escalation
    IF within = interval '0' THEN
        RETURN 0;
    END IF;

    IF subName IS NOT NULL AND user_id = (SELECT "Sub"."userId" FROM "Sub" WHERE "Sub"."name" = subName) THEN
        RETURN 0;
    END IF;

    SELECT count(*) INTO repeats
    FROM "Item"
    LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName"
    WHERE (
        (parent_id IS NULL AND "parentId" IS NULL)
        OR
        ("parentId" = parent_id AND user_id <> (SELECT i."userId" FROM "Item" i WHERE i.id = "Item"."rootId"))
    )
    AND "Item"."userId" = user_id
    AND "bio" = 'f'
    AND ("Sub"."name" IS NULL OR "Sub"."userId" <> user_id)
    AND "Item".created_at > now_utc() - within;

    IF parent_id IS NULL THEN
        RETURN repeats;
    END IF;

    WITH RECURSIVE base AS (
        SELECT "Item".id, "Item"."parentId", "Item"."userId"
        FROM "Item"
        WHERE id = parent_id
        AND "userId" = user_id
        AND created_at > now_utc() - within
        AND user_id <> (SELECT i."userId" FROM "Item" i WHERE i.id = "Item"."rootId")
      UNION ALL
        SELECT "Item".id, "Item"."parentId", "Item"."userId"
        FROM base p
        JOIN "Item" ON "Item".id = p."parentId" AND "Item"."userId" = p."userId" AND "Item".created_at > now_utc() - within)
    SELECT count(*) INTO self_replies FROM base;

    RETURN repeats + self_replies;
END;
$$;
