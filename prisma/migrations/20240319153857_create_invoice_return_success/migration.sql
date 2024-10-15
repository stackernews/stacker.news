-- return integer based on update
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
        RETURN 0;
    END IF;
    RETURN 1;
END;
$$;