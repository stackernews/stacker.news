DROP FUNCTION IF EXISTS create_invoice(hash TEXT, bolt11 TEXT, expires_at timestamp(3) without time zone, msats_req BIGINT, user_id INTEGER, idesc TEXT);
-- make invoice limit and balance limit configurable
CREATE OR REPLACE FUNCTION create_invoice(hash TEXT, bolt11 TEXT, expires_at timestamp(3) without time zone,
    msats_req BIGINT, user_id INTEGER, idesc TEXT, inv_limit INTEGER, balance_limit_msats BIGINT)
RETURNS "Invoice"
LANGUAGE plpgsql
AS $$
DECLARE
    invoice "Invoice";
    inv_limit_reached BOOLEAN;
    balance_limit_reached BOOLEAN;
    inv_pending_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    -- prevent too many pending invoices
    SELECT inv_limit > 0 AND count(*) >= inv_limit, sum("msatsRequested") INTO inv_limit_reached, inv_pending_msats
    FROM "Invoice"
    WHERE "userId" = user_id AND "expiresAt" > now_utc() AND "confirmedAt" IS NULL AND cancelled = false;

    IF inv_limit_reached THEN
        RAISE EXCEPTION 'SN_INV_PENDING_LIMIT';
    END IF;

    -- prevent pending invoices + msats from exceeding the limit
    SELECT balance_limit_msats > 0 AND inv_pending_msats+msats_req+msats > balance_limit_msats INTO balance_limit_reached
    FROM users
    WHERE id = user_id;

    IF balance_limit_reached THEN
        RAISE EXCEPTION 'SN_INV_EXCEED_BALANCE';
    END IF;

    -- we good, proceed frens
    INSERT INTO "Invoice" (hash, bolt11, "expiresAt", "msatsRequested", "userId", created_at, updated_at, "desc")
    VALUES (hash, bolt11, expires_at, msats_req, user_id, now_utc(), now_utc(), idesc) RETURNING * INTO invoice;

    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('checkInvoice', jsonb_build_object('hash', hash), 21, true, now() + interval '10 seconds');

    RETURN invoice;
END;
$$;

-- don't presume outlaw status for anon posters
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

-- keep item_spam unaware of anon user
CREATE OR REPLACE FUNCTION item_spam(parent_id INTEGER, user_id INTEGER, within INTERVAL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    repeats INTEGER;
    self_replies INTEGER;
BEGIN
    -- no fee escalation
    IF within = interval '0' THEN
        RETURN 0;
    END IF;

    SELECT count(*) INTO repeats
    FROM "Item"
    WHERE (parent_id IS NULL AND "parentId" IS NULL OR "parentId" = parent_id)
    AND "userId" = user_id
    AND created_at > now_utc() - within;

    IF parent_id IS NULL THEN
        RETURN repeats;
    END IF;

    WITH RECURSIVE base AS (
        SELECT "Item".id, "Item"."parentId", "Item"."userId"
        FROM "Item"
        WHERE id = parent_id AND "userId" = user_id AND created_at > now_utc() - within
      UNION ALL
        SELECT "Item".id, "Item"."parentId", "Item"."userId"
        FROM base p
        JOIN "Item" ON "Item".id = p."parentId" AND "Item"."userId" = p."userId" AND "Item".created_at > now_utc() - within)
    SELECT count(*) INTO self_replies FROM base;

    RETURN repeats + self_replies;
END;
$$;