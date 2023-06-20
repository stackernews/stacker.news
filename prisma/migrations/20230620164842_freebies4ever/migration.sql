CREATE OR REPLACE FUNCTION create_item(
    sub TEXT, title TEXT, url TEXT, text TEXT, boost INTEGER, bounty INTEGER,
    parent_id INTEGER, user_id INTEGER, fwd_user_id INTEGER,
    spam_within INTERVAL)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    cost_msats BIGINT;
    freebie BOOLEAN;
    item "Item";
    med_votes FLOAT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats INTO user_msats FROM users WHERE id = user_id;

    cost_msats := 1000 * POWER(10, item_spam(parent_id, user_id, spam_within));
    -- it's only a freebie if it's a 1 sat cost, they have < 1 sat, boost = 0, and they have freebies left
    freebie := (cost_msats <= 1000) AND (user_msats < 1000) AND (boost = 0);

    IF NOT freebie AND cost_msats > user_msats THEN
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

    INSERT INTO "Item"
    ("subName", title, url, text, bounty, "userId", "parentId", "fwdUserId",
        freebie, "weightedDownVotes", created_at, updated_at)
    VALUES
    (sub, title, url, text, bounty, user_id, parent_id, fwd_user_id,
        freebie, med_votes, now_utc(), now_utc()) RETURNING * INTO item;

    IF NOT freebie THEN
        UPDATE users SET msats = msats - cost_msats WHERE id = user_id;

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
        VALUES (cost_msats, item.id, user_id, 'FEE', now_utc(), now_utc());
    END IF;

    IF boost > 0 THEN
        PERFORM item_act(item.id, user_id, 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;