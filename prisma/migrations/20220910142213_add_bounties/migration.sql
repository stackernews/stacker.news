ALTER TABLE "Item" ADD COLUMN "bounty" INTEGER;
ALTER TABLE "Item" ADD CONSTRAINT "bounty" CHECK ("bounty" IS NULL OR "bounty" > 0) NOT VALID;

CREATE OR REPLACE FUNCTION create_item(
    title TEXT, url TEXT, text TEXT, boost INTEGER, bounty INTEGER,
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

    INSERT INTO "Item" (title, url, text, bounty, "userId", "parentId", "fwdUserId", "paidImgLink", created_at, updated_at)
    VALUES (title, url, text, bounty, user_id, parent_id, fwd_user_id, has_img_link, now_utc(), now_utc()) RETURNING * INTO item;

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

CREATE OR REPLACE FUNCTION update_item(item_id INTEGER,
    item_title TEXT, item_url TEXT, item_text TEXT, boost INTEGER, item_bounty INTEGER,
    fwd_user_id INTEGER, has_img_link BOOLEAN)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats INTEGER;
    prior_cost INTEGER;
    prior_act_id INTEGER;
    cost INTEGER;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT * INTO item FROM "Item" WHERE id = item_id;

    -- if has_img_link we need to figure out new costs, which is their prior_cost * 9
    IF has_img_link AND NOT item."paidImgLink" THEN
        SELECT sats * 1000, id INTO prior_cost, prior_act_id
        FROM "ItemAct"
        WHERE act = 'VOTE' AND "itemId" = item.id AND "userId" = item."userId";

        cost := prior_cost * 9;

        IF cost > user_msats THEN
            RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
        END IF;

        UPDATE users SET msats = msats - cost WHERE id = item."userId";

        UPDATE "ItemAct" SET sats = (prior_cost + cost) / 1000 WHERE id = prior_act_id;
    END IF;

    UPDATE "Item" set title = item_title, url = item_url, text = item_text, bounty = item_bounty, "fwdUserId" = fwd_user_id, "paidImgLink" = has_img_link
    WHERE id = item_id
    RETURNING * INTO item;

    IF boost > 0 THEN
        PERFORM item_act(item.id, item."userId", 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;
