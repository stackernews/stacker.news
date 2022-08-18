CREATE OR REPLACE FUNCTION update_item(item_id INTEGER,
    item_title TEXT, item_url TEXT, item_text TEXT, boost INTEGER,
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

    UPDATE "Item" set title = item_title, url = item_url, text = item_text, "fwdUserId" = fwd_user_id, "paidImgLink" = has_img_link
    WHERE id = item_id
    RETURNING * INTO item;

    IF boost > 0 THEN
        PERFORM item_act(item.id, item."userId", 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION create_poll(
    title TEXT, text TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER,
    options TEXT[], fwd_user_id INTEGER, has_img_link BOOLEAN, spam_within INTERVAL)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := create_item(title, null, text, boost, null, user_id, fwd_user_id, has_img_link, spam_within);

    UPDATE "Item" set "pollCost" = poll_cost where id = item.id;
    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION update_poll(
    id INTEGER, title TEXT, text TEXT, boost INTEGER,
    options TEXT[], fwd_user_id INTEGER, has_img_link BOOLEAN)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := update_item(id, title, null, text, boost, fwd_user_id, has_img_link);

    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION create_bio(title TEXT, text TEXT, user_id INTEGER, has_img_link BOOLEAN)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT * INTO item FROM create_item(title, NULL, text, 0, NULL, user_id, NULL, has_img_link, '0');

    UPDATE users SET "bioId" = item.id WHERE id = user_id;

    RETURN item;
END;
$$;