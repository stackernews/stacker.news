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
    med_votes FLOAT;
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

    INSERT INTO "Item" (title, url, text, "userId", "parentId", "fwdUserId", "paidImgLink", "weightedDownVotes", created_at, updated_at)
    VALUES (title, url, text, user_id, parent_id, fwd_user_id, has_img_link, med_votes, now_utc(), now_utc()) RETURNING * INTO item;

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