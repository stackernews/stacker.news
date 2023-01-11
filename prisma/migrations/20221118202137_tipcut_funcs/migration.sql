-- convert all self-votes to FEEs
UPDATE "ItemAct"
SET act = 'FEE'
FROM "Item"
WHERE act = 'VOTE'
AND "Item".id = "ItemAct"."itemId"
AND "Item"."userId" = "ItemAct"."userId";

-- convert all votes to TIPs
UPDATE "ItemAct"
SET act = 'TIP'
WHERE act = 'VOTE';

-- change vote on creation to act type FEE
CREATE OR REPLACE FUNCTION create_item(
    title TEXT, url TEXT, text TEXT, boost INTEGER,
    parent_id INTEGER, user_id INTEGER, fwd_user_id INTEGER,
    spam_within INTERVAL)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    cost_msats BIGINT;
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

    cost_msats := 1000 * POWER(10, item_spam(parent_id, user_id, spam_within));
    -- it's only a freebie if it's a 1 sat cost, they have < 1 sat, boost = 0, and they have freebies left
    freebie := (cost_msats <= 1000) AND (user_msats < 1000) AND (boost = 0) AND ((parent_id IS NULL AND free_posts > 0) OR (parent_id IS NOT NULL AND free_comments > 0));

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

    INSERT INTO "Item" (title, url, text, "userId", "parentId", "fwdUserId", freebie, "weightedDownVotes", created_at, updated_at)
    VALUES (title, url, text, user_id, parent_id, fwd_user_id, freebie, med_votes, now_utc(), now_utc()) RETURNING * INTO item;

    IF freebie THEN
        IF parent_id IS NULL THEN
            UPDATE users SET "freePosts" = "freePosts" - 1 WHERE id = user_id;
        ELSE
            UPDATE users SET "freeComments" = "freeComments" - 1 WHERE id = user_id;
        END IF;
    ELSE
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

-- change item_act to take FEE and remove VOTE
CREATE OR REPLACE FUNCTION item_act(item_id INTEGER, user_id INTEGER, act "ItemActType", act_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    act_msats BIGINT;
    fee_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    act_msats := act_sats * 1000;
    SELECT msats INTO user_msats FROM users WHERE id = user_id;
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
            VALUES (fee_msats, item_id, user_id, 'FEE', now_utc(), now_utc());

        -- add sats to actee's balance and stacked count
        UPDATE users
        SET msats = msats + act_msats, "stackedMsats" = "stackedMsats" + act_msats
        WHERE id = (SELECT COALESCE("fwdUserId", "userId") FROM "Item" WHERE id = item_id);

        -- leave the rest as a tip
        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
        VALUES (act_msats, item_id, user_id, 'TIP', now_utc(), now_utc());

        -- call to denormalize sats and commentSats
        PERFORM sats_after_tip(item_id, user_id, act_msats + fee_msats);
    ELSE -- BOOST, POLL, DONT_LIKE_THIS
        -- call to influence if DONT_LIKE_THIS weightedDownVotes
        IF act = 'DONT_LIKE_THIS' THEN
            -- make sure they haven't done this before
            IF EXISTS (SELECT 1 FROM "ItemAct" WHERE "itemId" = item_id AND "userId" = user_id AND "ItemAct".act = 'DONT_LIKE_THIS') THEN
                RAISE EXCEPTION 'SN_DUPLICATE';
            END IF;

            PERFORM weighted_downvotes_after_act(item_id, user_id, act_sats);
        END IF;

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
        VALUES (act_msats, item_id, user_id, act, now_utc(), now_utc());
    END IF;

    RETURN 0;
END;
$$;

-- remove triggers for weightedVotes and weightedDownVotes, replacing with functions called directly
DROP TRIGGER IF EXISTS weighted_votes_after_act ON "ItemAct";
DROP FUNCTION weighted_votes_after_act();
CREATE OR REPLACE FUNCTION weighted_votes_after_tip(item_id INTEGER, user_id INTEGER, sats INTEGER) RETURNS INTEGER AS $$
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
    WHERE "userId" = user_id AND "itemId" = item_id AND act IN ('TIP', 'FEE');

    IF sats_past IS NULL OR sats_past = 0 THEN
        multiplier := LOG(sats);
    ELSE
        multiplier := LOG((sats+sats_past)/sats_past::FLOAT);
    END IF;

    -- update item
    UPDATE "Item"
        SET "weightedVotes" = "weightedVotes" + (user_trust * multiplier)
        WHERE id = item_id AND "userId" <> user_id;

    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- TODO: maybe let sats affect downvoting as well
DROP TRIGGER IF EXISTS weighted_downvotes_after_act ON "ItemAct";
DROP FUNCTION weighted_downvotes_after_act();
CREATE OR REPLACE FUNCTION weighted_downvotes_after_act(item_id INTEGER, user_id INTEGER, sats INTEGER) RETURNS INTEGER AS $$
DECLARE
    user_trust DOUBLE PRECISION;
    sats_past INTEGER;
    multiplier DOUBLE PRECISION;
BEGIN
    -- grab user's trust
    SELECT trust INTO user_trust FROM users WHERE id = user_id;

    -- update item
    UPDATE "Item"
        SET "weightedDownVotes" = "weightedDownVotes" + user_trust
        WHERE id = item_id AND "userId" <> user_id;

    RETURN 0;
END;
$$ LANGUAGE plpgsql;


-- remove triggers to ItemAct sats and replace with functions called directly
DROP TRIGGER IF EXISTS sats_after_act_trigger ON "ItemAct";
DROP FUNCTION sats_after_act();
CREATE OR REPLACE FUNCTION sats_after_tip(item_id INTEGER, user_id INTEGER, tip_msats BIGINT) RETURNS INTEGER AS $$
DECLARE
    item "Item";
BEGIN
    SELECT * FROM "Item" WHERE id = item_id INTO item;
    IF item."userId" = user_id THEN
        RETURN 0;
    END IF;

    UPDATE "Item"
    SET "msats" = "msats" + tip_msats
    WHERE id = item.id;

    UPDATE "Item"
    SET "commentMsats" = "commentMsats" + tip_msats
    WHERE id <> item.id and path @> item.path;

    RETURN 1;
END;
$$ LANGUAGE plpgsql;