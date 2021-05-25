-- AlterTable
ALTER TABLE "users" ADD COLUMN     "freeComments" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "freePosts" INTEGER NOT NULL DEFAULT 2;


-- if user has free comments or posts, use that
CREATE OR REPLACE FUNCTION create_item(title TEXT, url TEXT, text TEXT, parent_id INTEGER, username TEXT)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_sats INTEGER;
    free_posts INTEGER;
    free_comments INTEGER;
    freebie BOOLEAN;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT (msats / 1000), id, "freePosts", "freeComments"
    INTO user_sats, user_id, free_posts, free_comments
    FROM users WHERE name = username;

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

        INSERT INTO "Vote" (sats, "itemId", "userId", created_at, updated_at)
        VALUES (1, item.id, user_id, now_utc(), now_utc());
    END IF;

    RETURN item;
END;
$$;