CREATE OR REPLACE FUNCTION referral_act(referrer_id INTEGER, item_act_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    act_msats BIGINT;
    referral_act "ItemActType";
    referral_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats, act INTO act_msats, referral_act FROM "ItemAct" WHERE id = item_act_id;

    IF referral_act IN ('FEE', 'BOOST', 'STREAM') THEN
        referral_msats := CEIL(act_msats * .21);
        INSERT INTO "ReferralAct" ("referrerId", "itemActId", msats, created_at, updated_at)
            VALUES(referrer_id, item_act_id, referral_msats, now_utc(), now_utc());
        UPDATE users
        SET msats = msats + referral_msats, "stackedMsats" = "stackedMsats" + referral_msats
        WHERE id = referrer_id;
    END IF;

    RETURN 0;
END;
$$;

-- add referral act on item_act
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

CREATE OR REPLACE FUNCTION run_auction(item_id INTEGER) RETURNS void AS $$
    DECLARE
        bid_sats INTEGER;
        user_msats BIGINT;
        user_id INTEGER;
        item_status "Status";
        status_updated_at timestamp(3);
    BEGIN
        PERFORM ASSERT_SERIALIZED();

        -- extract data we need
        SELECT "maxBid", "userId", status, "statusUpdatedAt" INTO bid_sats, user_id, item_status, status_updated_at FROM "Item" WHERE id = item_id;
        SELECT msats INTO user_msats FROM users WHERE id = user_id;

        -- 0 bid items expire after 30 days unless updated
        IF bid_sats = 0 THEN
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
        IF bid_sats * 1000 > user_msats THEN
            -- if not, set status = NOSATS and statusUpdatedAt to now_utc if not already set
            IF item_status <> 'NOSATS' THEN
                UPDATE "Item" SET status = 'NOSATS', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        ELSE
            PERFORM item_act(item_id, user_id, 'STREAM', bid_sats);

            -- update item status = ACTIVE and statusUpdatedAt = now_utc if NOSATS
            IF item_status = 'NOSATS' THEN
                UPDATE "Item" SET status = 'ACTIVE', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        END IF;
    END;
$$ LANGUAGE plpgsql;

-- retro actively, turn all invites into referrals
UPDATE users
SET "referrerId" = subquery.inviter
FROM (
  SELECT invitees.id AS invitee, inviters.id AS inviter
  FROM users invitees
  JOIN "Invite" ON invitees."inviteId" = "Invite".id
  JOIN users inviters ON inviters.id = "Invite"."userId") subquery
WHERE id = subquery.invitee;

-- make inviters referrers too
CREATE OR REPLACE FUNCTION invite_drain(user_id INTEGER, invite_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    inviter_id   INTEGER;
    inviter_sats INTEGER;
    gift         INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();
    -- check user was created in last hour
    -- check user did not already redeem an invite
    PERFORM FROM users
    WHERE id = user_id AND users.created_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 HOUR'
    AND users."inviteId" IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SN_INELIGIBLE';
    END IF;

    -- check that invite has not reached limit
    -- check that invite is not revoked
    SELECT "Invite"."userId", "Invite".gift INTO inviter_id, gift FROM "Invite"
    LEFT JOIN users ON users."inviteId" = invite_id
    WHERE "Invite".id = invite_id AND NOT "Invite".revoked
    GROUP BY "Invite".id
    HAVING COUNT(DISTINCT users.id) < "Invite".limit OR "Invite".limit IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SN_REVOKED_OR_EXHAUSTED';
    END IF;

    -- check that inviter has sufficient balance
    SELECT (msats / 1000) INTO inviter_sats
    FROM users WHERE id = inviter_id;
    IF inviter_sats < gift THEN
        RAISE EXCEPTION 'SN_REVOKED_OR_EXHAUSTED';
    END IF;

    -- subtract amount from inviter
    UPDATE users SET msats = msats - (1000 * gift) WHERE id = inviter_id;
    -- add amount to invitee
    UPDATE users SET msats = msats + (1000 * gift), "inviteId" = invite_id, "referrerId" = inviter_id WHERE id = user_id;

    RETURN 0;
END;
$$;