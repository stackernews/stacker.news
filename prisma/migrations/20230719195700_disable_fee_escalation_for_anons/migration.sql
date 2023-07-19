CREATE OR REPLACE FUNCTION item_spam(parent_id INTEGER, user_id INTEGER, within INTERVAL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    repeats INTEGER;
    self_replies INTEGER;
BEGIN
    IF user_id = 27 THEN
        -- disable fee escalation for anon user
        RETURN 0;
    END IF;

    SELECT count(*) INTO repeats
    FROM "Item"
    WHERE (parent_id IS NULL AND "parentId" IS NULL OR "parentId" = parent_id)
    AND "userId" = user_id
    AND created_at > now_utc() - within;

    IF parent_id IS NULL THEN
        RETURN repeats;
    END IF;

    WITH RECURSIVE base AS (
        SELECT "Item".id, "Item"."parentId", "Item"."userId"
        FROM "Item"
        WHERE id = parent_id AND "userId" = user_id AND created_at > now_utc() - within
      UNION ALL
        SELECT "Item".id, "Item"."parentId", "Item"."userId"
        FROM base p
        JOIN "Item" ON "Item".id = p."parentId" AND "Item"."userId" = p."userId" AND "Item".created_at > now_utc() - within)
    SELECT count(*) INTO self_replies FROM base;

    RETURN repeats + self_replies;
END;
$$;