CREATE OR REPLACE FUNCTION item_spam(parent_id INTEGER, user_id INTEGER, within INTERVAL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    repeats INTEGER;
    self_replies INTEGER;
BEGIN
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

CREATE OR REPLACE FUNCTION create_item(
    title TEXT, url TEXT, text TEXT, boost INTEGER,
    parent_id INTEGER, user_id INTEGER, fwd_user_id INTEGER,
    has_img_link BOOLEAN, spam_within INTERVAL)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats INTEGER;
    cost INTEGER;
    free_posts INTEGER;
    free_comments INTEGER;
    freebie BOOLEAN;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats, "freePosts", "freeComments"
    INTO user_msats, free_posts, free_comments
    FROM users WHERE id = user_id;

    freebie := (parent_id IS NULL AND free_posts > 0) OR (parent_id IS NOT NULL AND free_comments > 0);
    cost := 1000 * POWER(10, item_spam(parent_id, user_id, spam_within)) * CASE WHEN has_img_link THEN 10 ELSE 1 END;

    IF NOT freebie AND cost > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    INSERT INTO "Item" (title, url, text, "userId", "parentId", "fwdUserId", "paidImgLink", created_at, updated_at)
    VALUES (title, url, text, user_id, parent_id, fwd_user_id, has_img_link, now_utc(), now_utc()) RETURNING * INTO item;

    IF freebie THEN
        IF parent_id IS NULL THEN
            UPDATE users SET "freePosts" = "freePosts" - 1 WHERE id = user_id;
        ELSE
            UPDATE users SET "freeComments" = "freeComments" - 1 WHERE id = user_id;
        END IF;
    ELSE
        UPDATE users SET msats = msats - cost WHERE id = user_id;

        INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
        VALUES (cost / 1000, item.id, user_id, 'VOTE', now_utc(), now_utc());
    END IF;

    IF boost > 0 THEN
        PERFORM item_act(item.id, user_id, 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;