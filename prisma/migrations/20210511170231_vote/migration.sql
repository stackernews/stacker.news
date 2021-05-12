-- This is an empty migration.

CREATE OR REPLACE FUNCTION vote(item_id INTEGER, username TEXT, vote_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_sats INTEGER;
BEGIN
    SELECT (msats / 1000), id INTO user_sats, user_id FROM users WHERE name = username;
    IF vote_sats > user_sats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - (vote_sats * 1000) WHERE id = user_id;

    IF EXISTS (SELECT 1 FROM "Vote" WHERE "itemId" = item_id AND "userId" = user_id) THEN
        INSERT INTO "Vote" (sats, "itemId", "userId", boost, updated_at) VALUES (vote_sats, item_id, user_id, true, 'now');
    ELSE
        INSERT INTO "Vote" (sats, "itemId", "userId", updated_at) VALUES (vote_sats, item_id, user_id, 'now');
        UPDATE users SET msats = msats + (vote_sats * 1000) WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);
    END IF;

    RETURN vote_sats;
END;
$$;

CREATE OR REPLACE FUNCTION create_item(title TEXT, url TEXT, text TEXT, parent_id INTEGER, username TEXT)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_sats INTEGER;
    item "Item";
BEGIN
    SELECT (msats / 1000), id INTO user_sats, user_id FROM users WHERE name = username;
    IF 1 > user_sats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - 1000 WHERE id = user_id;

    INSERT INTO "Item" (title, url, text, "userId", "parentId", updated_at)
    VALUES (title, url, text, user_id, parent_id, 'now') RETURNING * INTO item;
    INSERT INTO "Vote" (sats, "itemId", "userId", updated_at) VALUES (1, item.id, user_id, 'now');

    RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION confirm_invoice(lnd_id TEXT, lnd_received INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    confirmed_at TIMESTAMP;
BEGIN
    SELECT "userId", "confirmedAt" INTO user_id, confirmed_at FROM "Invoice" WHERE hash = lnd_id;
    IF confirmed_at IS NULL THEN
        UPDATE "Invoice" SET "msatsReceived" = lnd_received, "confirmedAt" = 'now'  WHERE hash = lnd_id;
        UPDATE users SET msats = msats + lnd_received WHERE id = user_id;
    END IF;
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION create_withdrawl(lnd_id TEXT, bolt11 TEXT, msats_amount INTEGER, msats_max_fee INTEGER, username TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_msats INTEGER;
    withdrawl "Withdrawl";
BEGIN
    SELECT msats, id INTO user_msats, user_id FROM users WHERE name = username;
    IF msats_amount + msats_max_fee > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    INSERT INTO "Withdrawl" (hash, bolt11, "msatsPaying", "msatsFeePaying", "userId", updated_at)
    VALUES (lnd_id, bolt11, msats_amount, msats_max_fee, user_id, 'now') RETURNING * INTO withdrawl;

    UPDATE users SET msats = msats - msats_amount - msats_max_fee WHERE id = user_id;

    RETURN withdrawl;
END;
$$;