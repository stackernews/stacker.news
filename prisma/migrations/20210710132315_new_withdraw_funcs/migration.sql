-- This is an empty migration.

CREATE OR REPLACE FUNCTION create_withdrawl(lnd_id TEXT, invoice TEXT, msats_amount INTEGER, msats_max_fee INTEGER, username TEXT)
RETURNS "Withdrawl"
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_msats INTEGER;
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

    RETURN withdrawl;
END;
$$;

CREATE OR REPLACE FUNCTION confirm_withdrawl(wid INTEGER, msats_paid INTEGER, msats_fee_paid INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    msats_fee_paying INTEGER;
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
    msats_fee_paying INTEGER;
    msats_paying INTEGER;
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