-- make sure we nuke the old versions
DROP FUNCTION create_item(text,text,text,integer,integer);

CREATE OR REPLACE FUNCTION create_item(title TEXT, url TEXT, text TEXT, boost INTEGER, parent_id INTEGER, user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_sats INTEGER;
    free_posts INTEGER;
    free_comments INTEGER;
    freebie BOOLEAN;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT (msats / 1000), "freePosts", "freeComments"
    INTO user_sats, free_posts, free_comments
    FROM users WHERE id = user_id;

    freebie := (parent_id IS NULL AND free_posts > 0) OR (parent_id IS NOT NULL AND free_comments > 0);

    IF NOT freebie AND 1 > user_sats  THEN
      RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    INSERT INTO "Item" (title, url, text, "userId", "parentId", created_at, updated_at)
    VALUES (title, url, text, user_id, parent_id, now_utc(), now_utc()) RETURNING * INTO item;

    IF freebie THEN
        IF parent_id IS NULL THEN
            UPDATE users SET "freePosts" = "freePosts" - 1 WHERE id = user_id;
        ELSE
            UPDATE users SET "freeComments" = "freeComments" - 1 WHERE id = user_id;
        END IF;
    ELSE
        UPDATE users SET msats = msats - 1000 WHERE id = user_id;

        INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
        VALUES (1, item.id, user_id, 'VOTE', now_utc(), now_utc());
    END IF;

    IF boost > 0 THEN
        PERFORM item_act(item.id, user_id, 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;