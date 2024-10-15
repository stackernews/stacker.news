DROP FUNCTION weighted_downvotes_after_act(item_id INTEGER, user_id INTEGER, sats INTEGER);
CREATE OR REPLACE FUNCTION weighted_downvotes_after_act(item_id INTEGER, user_id INTEGER, sats INTEGER) RETURNS INTEGER AS $$
DECLARE
    user_trust DOUBLE PRECISION;
    sats_past INTEGER;
    multiplier DOUBLE PRECISION;
BEGIN
    -- grab user's trust who is upvoting
    SELECT trust INTO user_trust FROM users WHERE id = user_id;

    -- in order to add this to weightedVotes, we need to do log((satsN+satsPrior)/satsPrior)
    -- so compute sats prior
    SELECT SUM(msats) / 1000 INTO sats_past
    FROM "ItemAct"
    WHERE "userId" = user_id AND "itemId" = item_id AND act IN ('DONT_LIKE_THIS');

    IF sats_past IS NULL OR sats_past = 0 THEN
        multiplier := LOG(sats);
    ELSE
        multiplier := LOG((sats+sats_past)/sats_past::FLOAT);
    END IF;

    -- update item
    UPDATE "Item"
        SET "weightedDownVotes" = "weightedDownVotes" + (user_trust * multiplier)
        WHERE id = item_id AND "userId" <> user_id;

    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Update item_act to support multiple dont_like_this
CREATE OR REPLACE FUNCTION item_act(item_id INTEGER, user_id INTEGER, act "ItemActType", act_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    act_msats BIGINT;
    fee_msats BIGINT;
    item_act_id INTEGER;
    fwd_entry record; -- for loop iterator variable to iterate across forward recipients
    fwd_msats BIGINT; -- for loop variable calculating how many msats to give each forward recipient
    total_fwd_msats BIGINT := 0; -- accumulator to see how many msats have been forwarded for the act
BEGIN
    PERFORM ASSERT_SERIALIZED();

    act_msats := act_sats * 1000;
    SELECT msats INTO user_msats FROM users WHERE id = user_id;
    IF act_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- deduct msats from actor
    UPDATE users SET msats = msats - act_msats WHERE id = user_id;

    IF act = 'TIP' THEN
        -- call to influence weightedVotes ... we need to do this before we record the acts because
        -- the priors acts are taken into account
        PERFORM weighted_votes_after_tip(item_id, user_id, act_sats);
        -- call to denormalize sats and commentSats
        PERFORM sats_after_tip(item_id, user_id, act_msats);

        -- take 10% and insert as FEE
        fee_msats := CEIL(act_msats * 0.1);
        act_msats := act_msats - fee_msats;

        -- save the fee act into item_act_id so we can record referral acts
        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
            VALUES (fee_msats, item_id, user_id, 'FEE', now_utc(), now_utc())
            RETURNING id INTO item_act_id;

        -- leave the rest as a tip
        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_msats, item_id, user_id, 'TIP', now_utc(), now_utc());

        -- denormalize bounty paid (if applicable)
        PERFORM bounty_paid_after_act(item_id, user_id);

        -- add sats to actees' balance and stacked count
        FOR fwd_entry IN SELECT "userId", "pct" FROM "ItemForward" WHERE "itemId" = item_id
        LOOP
            -- fwd_msats represents the sats for this forward recipient from this particular tip action
            fwd_msats := act_msats * fwd_entry.pct / 100;
            -- keep track of how many msats have been forwarded, so we can give any remaining to OP
            total_fwd_msats := fwd_msats + total_fwd_msats;

            UPDATE users
            SET msats = msats + fwd_msats, "stackedMsats" = "stackedMsats" + fwd_msats
            WHERE id = fwd_entry."userId";
        END LOOP;

        -- Give OP any remaining msats after forwards have been applied
        IF act_msats - total_fwd_msats > 0 THEN
            UPDATE users
            SET msats = msats + act_msats - total_fwd_msats, "stackedMsats" = "stackedMsats" + act_msats - total_fwd_msats
            WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);
        END IF;
    ELSE -- BOOST, POLL, DONT_LIKE_THIS, STREAM
        -- call to influence if DONT_LIKE_THIS weightedDownVotes
        IF act = 'DONT_LIKE_THIS' THEN
            PERFORM weighted_downvotes_after_act(item_id, user_id, act_sats);
        END IF;

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_msats, item_id, user_id, act, now_utc(), now_utc())
            RETURNING id INTO item_act_id;
    END IF;

    -- store referral effects
    PERFORM referral_act(item_act_id);

    RETURN 0;
END;
$$;