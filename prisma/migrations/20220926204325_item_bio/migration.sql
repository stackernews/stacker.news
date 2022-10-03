DROP FUNCTION IF EXISTS create_bio(title TEXT, text TEXT, user_id INTEGER, has_img_link BOOLEAN);

-- when creating bio, set bio flag so they won't appear on first page
CREATE OR REPLACE FUNCTION create_bio(title TEXT, text TEXT, user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT * INTO item FROM create_item(title, NULL, text, 0, NULL, user_id, NULL, '0');

    UPDATE "Item" SET bio = true WHERE id = item.id;
    UPDATE users SET "bioId" = item.id WHERE id = user_id;

    RETURN item;
END;
$$;

DROP FUNCTION IF EXISTS create_item(
    title TEXT, url TEXT, text TEXT, boost INTEGER,
    parent_id INTEGER, user_id INTEGER, fwd_user_id INTEGER,
    has_img_link BOOLEAN, spam_within INTERVAL);

-- when creating free item, set freebie flag so can be optionally viewed
CREATE OR REPLACE FUNCTION create_item(
    title TEXT, url TEXT, text TEXT, boost INTEGER,
    parent_id INTEGER, user_id INTEGER, fwd_user_id INTEGER,
    spam_within INTERVAL)
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
    med_votes FLOAT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats, "freePosts", "freeComments"
    INTO user_msats, free_posts, free_comments
    FROM users WHERE id = user_id;

    cost := 1000 * POWER(10, item_spam(parent_id, user_id, spam_within));
    freebie := (cost <= 1000) AND ((parent_id IS NULL AND free_posts > 0) OR (parent_id IS NOT NULL AND free_comments > 0));

    IF NOT freebie AND cost > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- get this user's median item score
    SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP(ORDER BY "weightedVotes" - "weightedDownVotes"), 0) INTO med_votes FROM "Item" WHERE "userId" = user_id;

    -- if their median votes are positive, start at 0
    -- if the median votes are negative, start their post with that many down votes
    -- basically: if their median post is bad, presume this post is too
    IF med_votes >= 0 THEN
        med_votes := 0;
    ELSE
        med_votes := ABS(med_votes);
    END IF;

    INSERT INTO "Item" (title, url, text, "userId", "parentId", "fwdUserId", freebie, "weightedDownVotes", created_at, updated_at)
    VALUES (title, url, text, user_id, parent_id, fwd_user_id, freebie, med_votes, now_utc(), now_utc()) RETURNING * INTO item;

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

DROP FUNCTION IF EXISTS update_item(item_id INTEGER,
    item_title TEXT, item_url TEXT, item_text TEXT, boost INTEGER,
    fwd_user_id INTEGER, has_img_link BOOLEAN);

CREATE OR REPLACE FUNCTION update_item(item_id INTEGER,
    item_title TEXT, item_url TEXT, item_text TEXT, boost INTEGER,
    fwd_user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats INTEGER;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    UPDATE "Item" set title = item_title, url = item_url, text = item_text, "fwdUserId" = fwd_user_id
    WHERE id = item_id
    RETURNING * INTO item;

    IF boost > 0 THEN
        PERFORM item_act(item.id, item."userId", 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;

DROP FUNCTION IF EXISTS create_poll(
    title TEXT, text TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER,
    options TEXT[], fwd_user_id INTEGER, has_img_link BOOLEAN, spam_within INTERVAL);

CREATE OR REPLACE FUNCTION create_poll(
    title TEXT, text TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER,
    options TEXT[], fwd_user_id INTEGER, spam_within INTERVAL)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := create_item(title, null, text, boost, null, user_id, fwd_user_id, spam_within);

    UPDATE "Item" set "pollCost" = poll_cost where id = item.id;
    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;

DROP FUNCTION IF EXISTS update_poll(
    id INTEGER, title TEXT, text TEXT, boost INTEGER,
    options TEXT[], fwd_user_id INTEGER, has_img_link BOOLEAN);

CREATE OR REPLACE FUNCTION update_poll(
    id INTEGER, title TEXT, text TEXT, boost INTEGER,
    options TEXT[], fwd_user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := update_item(id, title, null, text, boost, fwd_user_id);

    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;