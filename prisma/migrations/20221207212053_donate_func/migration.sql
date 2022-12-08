CREATE OR REPLACE FUNCTION donate(sats INTEGER, user_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_sats INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats / 1000
    INTO user_sats
    FROM users WHERE id = user_id;

    IF sats > user_sats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - (sats * 1000) WHERE id = user_id;

    INSERT INTO "Donate" (sats, "userId", created_at, updated_at)
    VALUES (sats, user_id, now_utc(), now_utc());

    RETURN sats;
END;
$$;