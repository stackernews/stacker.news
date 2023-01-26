-- This is an empty migration.

-- This is an empty migration.
CREATE OR REPLACE FUNCTION bounty_paid_after_act(item_id INTEGER, user_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    root_id INTEGER;
    item_bounty INTEGER;
    sats_paid INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    -- get root item
    SELECT "rootId" INTO root_id FROM "Item" WHERE id = item_id;

    -- check if root item is 1. a bounty, 2. actor is the OP, 3. hasn't paid yet
    SELECT bounty
    INTO item_bounty
    FROM "Item"
    WHERE id = root_id
    AND "userId" = user_id
    AND ("bountyPaidTo" IS NULL OR item_id <> any ("bountyPaidTo"));

    -- if it is get the bounty amount
    IF item_bounty IS NOT NULL THEN
        -- check if the cumulative sats sent to this item by user_id is >= to bounty
        SELECT coalesce(sum("ItemAct"."msats"), 0)/1000
        INTO sats_paid
        FROM "ItemAct"
        WHERE "ItemAct"."userId" = user_id
        AND "ItemAct"."itemId" = item_id
        AND "ItemAct".act IN ('TIP','FEE');
        IF sats_paid >= item_bounty THEN
            UPDATE "Item"
            SET "bountyPaidTo" = array_append("bountyPaidTo", item_id)
            WHERE id = root_id;
        END IF;
    END IF;

    RETURN 0;
END;
$$;

-- This is an empty migration.
CREATE OR REPLACE FUNCTION item_act(item_id INTEGER, user_id INTEGER, act "ItemActType", act_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    act_msats BIGINT;
    fee_msats BIGINT;
    item_act_id INTEGER;
    referrer_id INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    act_msats := act_sats * 1000;
    SELECT msats, "referrerId" INTO user_msats, referrer_id FROM users WHERE id = user_id;
    IF act_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- deduct msats from actor
    UPDATE users SET msats = msats - act_msats WHERE id = user_id;

    IF act = 'VOTE' THEN
        RAISE EXCEPTION 'SN_UNSUPPORTED';
    END IF;

    IF act = 'TIP' THEN
        -- call to influence weightedVotes ... we need to do this before we record the acts because
        -- the priors acts are taken into account
        PERFORM weighted_votes_after_tip(item_id, user_id, act_sats);

        -- take 10% and insert as FEE
        fee_msats := CEIL(act_msats * 0.1);
        act_msats := act_msats - fee_msats;

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
            VALUES (fee_msats, item_id, user_id, 'FEE', now_utc(), now_utc())
            RETURNING id INTO item_act_id;

        -- add sats to actee's balance and stacked count
        UPDATE users
        SET msats = msats + act_msats, "stackedMsats" = "stackedMsats" + act_msats
        WHERE id = (SELECT COALESCE("fwdUserId", "userId") FROM "Item" WHERE id = item_id)
        RETURNING "referrerId" INTO referrer_id;

        -- leave the rest as a tip
        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
        VALUES (act_msats, item_id, user_id, 'TIP', now_utc(), now_utc());

        -- call to denormalize sats and commentSats
        PERFORM sats_after_tip(item_id, user_id, act_msats + fee_msats);
        -- denormalize bounty paid
        PERFORM bounty_paid_after_act(item_id, user_id);
    ELSE -- BOOST, POLL, DONT_LIKE_THIS, STREAM
        -- call to influence if DONT_LIKE_THIS weightedDownVotes
        IF act = 'DONT_LIKE_THIS' THEN
            -- make sure they haven't done this before
            IF EXISTS (SELECT 1 FROM "ItemAct" WHERE "itemId" = item_id AND "userId" = user_id AND "ItemAct".act = 'DONT_LIKE_THIS') THEN
                RAISE EXCEPTION 'SN_DUPLICATE';
            END IF;

            PERFORM weighted_downvotes_after_act(item_id, user_id, act_sats);
        END IF;

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_msats, item_id, user_id, act, now_utc(), now_utc())
            RETURNING id INTO item_act_id;
    END IF;

    -- they have a referrer and the referrer isn't the one tipping them
    IF referrer_id IS NOT NULL AND user_id <> referrer_id THEN
        PERFORM referral_act(referrer_id, item_act_id);
    END IF;

    RETURN 0;
END;
$$;