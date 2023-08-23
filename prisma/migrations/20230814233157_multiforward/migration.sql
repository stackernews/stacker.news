-- CreateTable
CREATE TABLE "ItemForward" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "pct" INTEGER NOT NULL,

    CONSTRAINT "ItemForward_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ItemForward" ADD CONSTRAINT "ItemForward_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemForward" ADD CONSTRAINT "ItemForward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ItemForward.itemId_index" ON "ItemForward"("itemId");

-- CreateIndex
CREATE INDEX "ItemForward.userId_index" ON "ItemForward"("userId");

-- CreateIndex
CREATE INDEX "ItemForward.createdAt_index" ON "ItemForward"("created_at");

-- Type used in create_item below for JSON processing
CREATE TYPE ItemForwardType as ("userId" INTEGER, "pct" INTEGER);

-- Migrate existing forward entries to the ItemForward table
-- All migrated entries will get 100% sats by default
INSERT INTO "ItemForward" ("itemId", "userId", "pct")
    SELECT "id" AS "itemId", "fwdUserId", 100 FROM "Item" WHERE "fwdUserId" IS NOT NULL;

-- Remove the existing fwdUserId column now that existing forwards have been migrated
ALTER TABLE "Item" DROP COLUMN "fwdUserId";

-- Delete old create_item function
DROP FUNCTION IF EXISTS create_item(
    sub TEXT, title TEXT, url TEXT, text TEXT, boost INTEGER, bounty INTEGER,
    parent_id INTEGER, user_id INTEGER, forward INTEGER,
    spam_within INTERVAL);

-- Update to create ItemForward entries accordingly
CREATE OR REPLACE FUNCTION create_item(
    sub TEXT, title TEXT, url TEXT, text TEXT, boost INTEGER, bounty INTEGER,
    parent_id INTEGER, user_id INTEGER, forward JSON,
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
    -- it's only a freebie if it's a 1 sat cost, they have < 1 sat, and boost = 0
    freebie := (cost_msats <= 1000) AND (user_msats < 1000) AND (boost = 0);

    IF NOT freebie AND cost_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- get this user's median item score
    SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP(ORDER BY "weightedVotes" - "weightedDownVotes"), 0)
        INTO med_votes FROM "Item" WHERE "userId" = user_id;

    -- if their median votes are positive, start at 0
    -- if the median votes are negative, start their post with that many down votes
    -- basically: if their median post is bad, presume this post is too
    -- addendum: if they're an anon poster, always start at 0
    IF med_votes >= 0 OR user_id = 27 THEN
        med_votes := 0;
    ELSE
        med_votes := ABS(med_votes);
    END IF;

    INSERT INTO "Item"
    ("subName", title, url, text, bounty, "userId", "parentId",
        freebie, "weightedDownVotes", created_at, updated_at)
    VALUES
    (sub, title, url, text, bounty, user_id, parent_id,
        freebie, med_votes, now_utc(), now_utc()) RETURNING * INTO item;

    INSERT INTO "ItemForward" ("itemId", "userId", "pct")
        SELECT item.id, "userId", "pct" from json_populate_recordset(null::ItemForwardType, forward);

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

DROP FUNCTION IF EXISTS update_item(
    sub TEXT, item_id INTEGER, item_title TEXT, item_url TEXT, item_text TEXT, boost INTEGER,
    item_bounty INTEGER, fwd_user_id INTEGER);

CREATE OR REPLACE FUNCTION update_item(
    sub TEXT, item_id INTEGER, item_title TEXT, item_url TEXT, item_text TEXT, boost INTEGER,
    item_bounty INTEGER, forward JSON)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats INTEGER;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    UPDATE "Item"
    SET "subName" = sub, title = item_title, url = item_url,
        text = item_text, bounty = item_bounty
    WHERE id = item_id
    RETURNING * INTO item;

    -- Delete all old forward entries, to recreate in next command
    DELETE FROM "ItemForward"
    WHERE "itemId" = item_id;

    INSERT INTO "ItemForward" ("itemId", "userId", "pct")
        SELECT item_id, "userId", "pct" from json_populate_recordset(null::ItemForwardType, forward);

    IF boost > 0 THEN
        PERFORM item_act(item.id, item."userId", 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;

DROP FUNCTION IF EXISTS create_poll(
    sub TEXT, title TEXT, text TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER,
    options TEXT[], fwd_user_id INTEGER, spam_within INTERVAL);

CREATE OR REPLACE FUNCTION create_poll(
    sub TEXT, title TEXT, text TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER,
    options TEXT[], forward JSON, spam_within INTERVAL)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := create_item(sub, title, null, text, boost, null, null, user_id, forward, spam_within);

    UPDATE "Item" set "pollCost" = poll_cost where id = item.id;
    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;

DROP FUNCTION IF EXISTS update_poll(
    sub TEXT, id INTEGER, title TEXT, text TEXT, boost INTEGER,
    options TEXT[], fwd_user_id INTEGER);

CREATE OR REPLACE FUNCTION update_poll(
    sub TEXT, id INTEGER, title TEXT, text TEXT, boost INTEGER,
    options TEXT[], forward JSON)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := update_item(sub, id, title, null, text, boost, null, forward);

    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;

-- Update item_act to support multi-way forward splits
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

    -- store referral effects
    PERFORM referral_act(item_act_id);

    RETURN 0;
END;
$$;

DROP FUNCTION referral_act(referrer_id INTEGER, item_act_id INTEGER);
DROP FUNCTION referral_act(referrer_id INTEGER, item_act_id INTEGER, act_msats BIGINT);

-- A new implementation of referral_act that accounts for forwards
CREATE OR REPLACE FUNCTION referral_act(item_act_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    act_act "ItemActType";
    act_msats BIGINT;
    act_item_id INTEGER;
    act_user_id INTEGER;
    referrer_id INTEGER;
    referral_msats BIGINT;
    fwd_ref_msats BIGINT;
    total_fwd_ref_msats BIGINT := 0;
    fwd_entry record;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    -- get the sats for the action that haven't already been forwarded
    SELECT msats, act, "userId", "itemId"
    INTO act_msats, act_act, act_user_id, act_item_id
    FROM "ItemAct"
    WHERE id = item_act_id;

    referral_msats := CEIL(act_msats * .21);

    -- take 21% of the act where the referrer is the actor's referrer
    IF act_act IN ('BOOST', 'STREAM') THEN
        SELECT "referrerId" INTO referrer_id FROM users WHERE id = act_user_id;

        IF referrer_id IS NULL THEN
            RETURN 0;
        END IF;

        INSERT INTO "ReferralAct" ("referrerId", "itemActId", msats, created_at, updated_at)
            VALUES(referrer_id, item_act_id, referral_msats, now_utc(), now_utc());
        UPDATE users
        SET msats = msats + referral_msats, "stackedMsats" = "stackedMsats" + referral_msats
        WHERE id = referrer_id;
    -- take 21% of the fee where the referrer is the item's creator (and/or the item's forward users)
    ELSIF act_act = 'FEE' THEN
        FOR fwd_entry IN
            SELECT users."referrerId" AS referrer_id, "ItemForward"."pct" AS pct
            FROM "ItemForward"
            JOIN users ON users.id = "ItemForward"."userId"
            WHERE "ItemForward"."itemId" = act_item_id
        LOOP
            -- fwd_msats represents the sats for this forward recipient from this particular tip action
            fwd_ref_msats := referral_msats * fwd_entry.pct / 100;
            -- keep track of how many msats have been forwarded, so we can give any remaining to OP
            total_fwd_ref_msats := fwd_ref_msats + total_fwd_ref_msats;

            -- no referrer or tipping their own referee, no referral act
            CONTINUE WHEN fwd_entry.referrer_id IS NULL OR fwd_entry.referrer_id = act_user_id;

            INSERT INTO "ReferralAct" ("referrerId", "itemActId", msats, created_at, updated_at)
            VALUES (fwd_entry.referrer_id, item_act_id, fwd_ref_msats, now_utc(), now_utc());

            UPDATE users
            SET msats = msats + fwd_ref_msats, "stackedMsats" = "stackedMsats" + fwd_ref_msats
            WHERE id = fwd_entry.referrer_id;
        END LOOP;

        -- Give OP any remaining msats after forwards have been applied
        IF referral_msats - total_fwd_ref_msats > 0 THEN
            SELECT users."referrerId" INTO referrer_id
            FROM "Item"
            JOIN users ON users.id = "Item"."userId"
            WHERE "Item".id = act_item_id;

            IF referrer_id IS NULL OR referrer_id = act_user_id THEN
                RETURN 0;
            END IF;

            INSERT INTO "ReferralAct" ("referrerId", "itemActId", msats, created_at, updated_at)
            VALUES (referrer_id, item_act_id, referral_msats - total_fwd_ref_msats, now_utc(), now_utc());

            UPDATE users
            SET msats = msats + referral_msats - total_fwd_ref_msats,
                "stackedMsats" = "stackedMsats" + referral_msats - total_fwd_ref_msats
            WHERE id = referrer_id;
        END IF;
    END IF;

    RETURN 0;
END;
$$;


-- constraints on ItemForward
ALTER TABLE "ItemForward" ADD CONSTRAINT "ItemForward_pct_range_check" CHECK ("pct" >= 0 AND "pct" <= 100) NOT VALID;

CREATE OR REPLACE FUNCTION item_forward_pct_total_trigger_func() RETURNS trigger
   LANGUAGE plpgsql AS $$
DECLARE
BEGIN
    IF (SELECT SUM(pct) FROM "ItemForward" WHERE "itemId" = NEW."itemId") > 100 THEN
        raise exception 'Total forward pct exceeds 100';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER item_forward_pct_total_trigger
   AFTER INSERT OR UPDATE ON "ItemForward"
   DEFERRABLE INITIALLY DEFERRED
   FOR EACH ROW
   EXECUTE PROCEDURE item_forward_pct_total_trigger_func();
