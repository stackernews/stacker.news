-- This is an empty migration.

create function now_utc() returns timestamp as $$
  select now() at time zone 'utc';
$$ language sql;

create function ASSERT_SERIALIZED() returns void as $$
BEGIN
    IF (select current_setting('transaction_isolation') <> 'serializable') THEN
        RAISE EXCEPTION 'SN_NOT_SERIALIZABLE';
    END IF;
END;
$$ language plpgsql;

CREATE OR REPLACE FUNCTION vote(item_id INTEGER, username TEXT, vote_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_sats INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT (msats / 1000), id INTO user_sats, user_id FROM users WHERE name = username;
    IF vote_sats > user_sats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - (vote_sats * 1000) WHERE id = user_id;

    IF EXISTS (SELECT 1 FROM "Vote" WHERE "itemId" = item_id AND "userId" = user_id) THEN
        INSERT INTO "Vote" (sats, "itemId", "userId", boost, created_at, updated_at)
        VALUES (vote_sats, item_id, user_id, true, now_utc(), now_utc());
    ELSE
        INSERT INTO "Vote" (sats, "itemId", "userId", created_at, updated_at)
        VALUES (1, item_id, user_id, now_utc(), now_utc());
        UPDATE users SET msats = msats + 1000 WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);
        IF vote_sats > 1 THEN
            INSERT INTO "Vote" (sats, "itemId", "userId", boost, created_at, updated_at)
            VALUES (vote_sats - 1, item_id, user_id, true, now_utc(), now_utc());
        END IF;
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
    PERFORM ASSERT_SERIALIZED();

    SELECT (msats / 1000), id INTO user_sats, user_id FROM users WHERE name = username;
    IF 1 > user_sats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - 1000 WHERE id = user_id;

    INSERT INTO "Item" (title, url, text, "userId", "parentId", created_at, updated_at)
    VALUES (title, url, text, user_id, parent_id, now_utc(), now_utc()) RETURNING * INTO item;

    INSERT INTO "Vote" (sats, "itemId", "userId", created_at, updated_at)
    VALUES (1, item.id, user_id, now_utc(), now_utc());

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