-- item_act should take sats but treat them as msats
CREATE OR REPLACE FUNCTION item_act(item_id INTEGER, user_id INTEGER, act "ItemActType", act_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    act_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    act_msats := act_sats * 1000;
    SELECT msats INTO user_msats FROM users WHERE id = user_id;
    IF act_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;


    -- deduct msats from actor
    UPDATE users SET msats = msats - act_msats WHERE id = user_id;

    IF act = 'VOTE' OR act = 'TIP' THEN
        -- add sats to actee's balance and stacked count
        UPDATE users
        SET msats = msats + act_msats, "stackedMsats" = "stackedMsats" + act_msats
        WHERE id = (SELECT COALESCE("fwdUserId", "userId") FROM "Item" WHERE id = item_id);

        -- if they have already voted, this is a tip
        IF EXISTS (SELECT 1 FROM "ItemAct" WHERE "itemId" = item_id AND "userId" = user_id AND "ItemAct".act = 'VOTE') THEN
            INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_msats, item_id, user_id, 'TIP', now_utc(), now_utc());
        ELSE
            -- else this is a vote with a possible extra tip
            INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
                VALUES (1000, item_id, user_id, 'VOTE', now_utc(), now_utc());
            act_msats := act_msats - 1000;

            -- if we have sats left after vote, leave them as a tip
            IF act_msats > 0 THEN
                INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
                    VALUES (act_msats, item_id, user_id, 'TIP', now_utc(), now_utc());
            END IF;

            RETURN 1;
        END IF;
    ELSE -- BOOST, POLL, DONT_LIKE_THIS
        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
        VALUES (act_msats, item_id, user_id, act, now_utc(), now_utc());
    END IF;

    RETURN 0;
END;
$$;

-- when creating free item, set freebie flag so can be optionally viewed
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
        VALUES (cost_msats, item.id, user_id, 'VOTE', now_utc(), now_utc());
    END IF;

    IF boost > 0 THEN
        PERFORM item_act(item.id, user_id, 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION run_auction(item_id INTEGER) RETURNS void AS $$
    DECLARE
        bid_msats BIGINT;
        user_msats BIGINT;
        user_id INTEGER;
        item_status "Status";
        status_updated_at timestamp(3);
    BEGIN
        PERFORM ASSERT_SERIALIZED();

        -- extract data we need
        SELECT "maxBid" * 1000, "userId", status, "statusUpdatedAt" INTO bid_msats, user_id, item_status, status_updated_at FROM "Item" WHERE id = item_id;
        SELECT msats INTO user_msats FROM users WHERE id = user_id;

        -- 0 bid items expire after 30 days unless updated
        IF bid_msats = 0 THEN
            IF item_status <> 'STOPPED' THEN
                IF status_updated_at < now_utc() - INTERVAL '30 days' THEN
                    UPDATE "Item" SET status = 'STOPPED', "statusUpdatedAt" = now_utc() WHERE id = item_id;
                ELSEIF item_status = 'NOSATS' THEN
                    UPDATE "Item" SET status = 'ACTIVE' WHERE id = item_id;
                END IF;
            END IF;
            RETURN;
        END IF;

        -- check if user wallet has enough sats
        IF bid_msats > user_msats THEN
            -- if not, set status = NOSATS and statusUpdatedAt to now_utc if not already set
            IF item_status <> 'NOSATS' THEN
                UPDATE "Item" SET status = 'NOSATS', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        ELSE
            -- if so, deduct from user
            UPDATE users SET msats = msats - bid_msats WHERE id = user_id;

            -- create an item act
            INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
            VALUES (bid_msats, item_id, user_id, 'STREAM', now_utc(), now_utc());

            -- update item status = ACTIVE and statusUpdatedAt = now_utc if NOSATS
            IF item_status = 'NOSATS' THEN
                UPDATE "Item" SET status = 'ACTIVE', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        END IF;
    END;
$$ LANGUAGE plpgsql;


-- on item act denormalize sats and comment sats
CREATE OR REPLACE FUNCTION sats_after_act() RETURNS TRIGGER AS $$
DECLARE
    item "Item";
BEGIN
    SELECT * FROM "Item" WHERE id = NEW."itemId" INTO item;
    IF item."userId" = NEW."userId" THEN
        RETURN NEW;
    END IF;

    UPDATE "Item"
    SET "msats" = "msats" + NEW.msats
    WHERE id = item.id;

    UPDATE "Item"
    SET "commentMsats" = "commentMsats" + NEW.msats
    WHERE id <> item.id and path @> item.path;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sats_after_act_trigger ON "ItemAct";
CREATE TRIGGER sats_after_act_trigger
    AFTER INSERT ON "ItemAct"
    FOR EACH ROW
    WHEN (NEW.act = 'VOTE' or NEW.act = 'TIP')
    EXECUTE PROCEDURE sats_after_act();

CREATE OR REPLACE FUNCTION boost_after_act() RETURNS TRIGGER AS $$
BEGIN
    -- update item
    UPDATE "Item" SET boost = boost + FLOOR(NEW.msats / 1000) WHERE id = NEW."itemId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS boost_after_act ON "ItemAct";
CREATE TRIGGER boost_after_act
    AFTER INSERT ON "ItemAct"
    FOR EACH ROW
    WHEN (NEW.act = 'BOOST')
    EXECUTE PROCEDURE boost_after_act();

DROP FUNCTION IF EXISTS create_invoice(TEXT, TEXT, timestamp(3) without time zone, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION create_invoice(hash TEXT, bolt11 TEXT, expires_at timestamp(3) without time zone, msats_req BIGINT, user_id INTEGER)
RETURNS "Invoice"
LANGUAGE plpgsql
AS $$
DECLARE
    invoice "Invoice";
    limit_reached BOOLEAN;
    too_much BOOLEAN;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT count(*) >= 10, coalesce(sum("msatsRequested"),0)+coalesce(max(users.msats), 0)+msats_req > 1000000000 INTO limit_reached, too_much
    FROM "Invoice"
    JOIN users on "userId" = users.id
    WHERE "userId" = user_id AND "expiresAt" > now_utc() AND "confirmedAt" is null AND cancelled = false;

    -- prevent more than 10 pending invoices
    IF limit_reached THEN
        RAISE EXCEPTION 'SN_INV_PENDING_LIMIT';
    END IF;

    -- prevent pending invoices + msats from exceeding 1,000,000 sats
    IF too_much THEN
        RAISE EXCEPTION 'SN_INV_EXCEED_BALANCE';
    END IF;

    INSERT INTO "Invoice" (hash, bolt11, "expiresAt", "msatsRequested", "userId", created_at, updated_at)
    VALUES (hash, bolt11, expires_at, msats_req, user_id, now_utc(), now_utc()) RETURNING * INTO invoice;

    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('checkInvoice', jsonb_build_object('hash', hash), 21, true, now() + interval '10 seconds');

    RETURN invoice;
END;
$$;

DROP FUNCTION IF EXISTS confirm_invoice(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION confirm_invoice(lnd_id TEXT, lnd_received BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    confirmed_at TIMESTAMP;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT "userId", "confirmedAt" INTO user_id, confirmed_at FROM "Invoice" WHERE hash = lnd_id;
    IF confirmed_at IS NULL THEN
        UPDATE "Invoice" SET "msatsReceived" = lnd_received, "confirmedAt" = now_utc(), updated_at = now_utc()
        WHERE hash = lnd_id;
        UPDATE users SET msats = msats + lnd_received WHERE id = user_id;
    END IF;
    RETURN 0;
END;
$$;

DROP FUNCTION IF EXISTS create_withdrawl(TEXT, TEXT, INTEGER, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION create_withdrawl(lnd_id TEXT, invoice TEXT, msats_amount BIGINT, msats_max_fee BIGINT, username TEXT)
RETURNS "Withdrawl"
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_msats BIGINT;
    withdrawl "Withdrawl";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats, id INTO user_msats, user_id FROM users WHERE name = username;
    IF (msats_amount + msats_max_fee) > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    IF EXISTS (SELECT 1 FROM "Withdrawl" WHERE hash = lnd_id AND status IS NULL) THEN
        RAISE EXCEPTION 'SN_PENDING_WITHDRAWL_EXISTS';
    END IF;

    IF EXISTS (SELECT 1 FROM "Withdrawl" WHERE hash = lnd_id AND status = 'CONFIRMED') THEN
        RAISE EXCEPTION 'SN_CONFIRMED_WITHDRAWL_EXISTS';
    END IF;

    INSERT INTO "Withdrawl" (hash, bolt11, "msatsPaying", "msatsFeePaying", "userId", created_at, updated_at)
    VALUES (lnd_id, invoice, msats_amount, msats_max_fee, user_id, now_utc(), now_utc()) RETURNING * INTO withdrawl;

    UPDATE users SET msats = msats - msats_amount - msats_max_fee WHERE id = user_id;

    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('checkWithdrawal', jsonb_build_object('id', withdrawl.id, 'hash', lnd_id), 21, true, now() + interval '10 seconds');

    RETURN withdrawl;
END;
$$;

DROP FUNCTION IF EXISTS confirm_withdrawl(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION confirm_withdrawl(wid INTEGER, msats_paid BIGINT, msats_fee_paid BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    msats_fee_paying BIGINT;
    user_id INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    IF EXISTS (SELECT 1 FROM "Withdrawl" WHERE id = wid AND status IS NULL) THEN
        SELECT "msatsFeePaying", "userId" INTO msats_fee_paying, user_id
        FROM "Withdrawl" WHERE id = wid AND status IS NULL;

        UPDATE "Withdrawl"
        SET status = 'CONFIRMED', "msatsPaid" = msats_paid,
        "msatsFeePaid" = msats_fee_paid, updated_at = now_utc()
        WHERE id = wid AND status IS NULL;

        UPDATE users SET msats = msats + (msats_fee_paying - msats_fee_paid) WHERE id = user_id;
    END IF;

    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION reverse_withdrawl(wid INTEGER, wstatus "WithdrawlStatus")
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    msats_fee_paying BIGINT;
    msats_paying BIGINT;
    user_id INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    IF EXISTS (SELECT 1 FROM "Withdrawl" WHERE id = wid AND status IS NULL) THEN
        SELECT "msatsPaying", "msatsFeePaying", "userId" INTO msats_paying, msats_fee_paying, user_id
        FROM "Withdrawl" WHERE id = wid AND status IS NULL;

        UPDATE "Withdrawl" SET status = wstatus, updated_at = now_utc() WHERE id = wid AND status IS NULL;

        UPDATE users SET msats = msats + msats_paying + msats_fee_paying WHERE id = user_id;
    END IF;
    RETURN 0;
END;
$$;

DROP FUNCTION IF EXISTS earn(INTEGER, INTEGER, TIMESTAMP(3), "EarnType", INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION earn(user_id INTEGER, earn_msats BIGINT, created_at TIMESTAMP(3),
    type "EarnType", type_id INTEGER, rank INTEGER)
RETURNS void AS $$
DECLARE
BEGIN
    PERFORM ASSERT_SERIALIZED();
    -- insert into earn
    INSERT INTO "Earn" (msats, "userId", created_at, type, "typeId", rank)
    VALUES (earn_msats, user_id, created_at, type, type_id, rank);

    -- give the user the sats
    UPDATE users
    SET msats = msats + earn_msats, "stackedMsats" = "stackedMsats" + earn_msats
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;