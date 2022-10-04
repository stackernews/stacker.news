CREATE OR REPLACE FUNCTION create_poll(title TEXT, text TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER, options TEXT[])
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := create_item(title, null, text, boost, null, user_id);

    UPDATE "Item" set "pollCost" = poll_cost where id = item.id;
    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;

-- create poll vote
-- if user hasn't already voted
-- charges user item.pollCost
-- adds POLL to ItemAct
-- adds PollVote
CREATE OR REPLACE FUNCTION poll_vote(option_id INTEGER, user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option "PollOption";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT * INTO option FROM "PollOption" where id = option_id;
    IF option IS NULL THEN
        RAISE EXCEPTION 'INVALID_POLL_OPTION';
    END IF;

    SELECT * INTO item FROM "Item" where id = option."itemId";
    IF item IS NULL THEN
        RAISE EXCEPTION 'POLL_DOES_NOT_EXIST';
    END IF;

    IF item."userId" = user_id THEN
        RAISE EXCEPTION 'POLL_OWNER_CANT_VOTE';
    END IF;

    IF EXISTS (SELECT 1 FROM "PollVote" WHERE "itemId" = item.id AND "userId" = user_id) THEN
        RAISE EXCEPTION 'POLL_VOTE_ALREADY_EXISTS';
    END IF;

    PERFORM item_act(item.id, user_id, 'POLL', item."pollCost");

    INSERT INTO "PollVote" (created_at, updated_at, "itemId", "pollOptionId", "userId")
        VALUES (now_utc(), now_utc(), item.id, option_id, user_id);

    RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION item_act(item_id INTEGER, user_id INTEGER, act "ItemActType", act_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_sats INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT (msats / 1000) INTO user_sats FROM users WHERE id = user_id;
    IF act_sats > user_sats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- deduct sats from actor
    UPDATE users SET msats = msats - (act_sats * 1000) WHERE id = user_id;

    IF act = 'BOOST' OR act = 'POLL' THEN
        INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
        VALUES (act_sats, item_id, user_id, act, now_utc(), now_utc());
    ELSE
        -- add sats to actee's balance and stacked count
        UPDATE users
        SET msats = msats + (act_sats * 1000), "stackedMsats" = "stackedMsats" + (act_sats * 1000)
        WHERE id = (SELECT COALESCE("fwdUserId", "userId") FROM "Item" WHERE id = item_id);

        -- if they have already voted, this is a tip
        IF EXISTS (SELECT 1 FROM "ItemAct" WHERE "itemId" = item_id AND "userId" = user_id AND "ItemAct".act = 'VOTE') THEN
            INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_sats, item_id, user_id, 'TIP', now_utc(), now_utc());
        ELSE
            -- else this is a vote with a possible extra tip
            INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
                VALUES (1, item_id, user_id, 'VOTE', now_utc(), now_utc());
            act_sats := act_sats - 1;

            -- if we have sats left after vote, leave them as a tip
            IF act_sats > 0 THEN
                INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
                    VALUES (act_sats, item_id, user_id, 'TIP', now_utc(), now_utc());
            END IF;

            RETURN 1;
        END IF;
    END IF;

    RETURN 0;
END;
$$;
