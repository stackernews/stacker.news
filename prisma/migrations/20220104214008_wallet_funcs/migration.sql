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

    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('checkWithdrawal', jsonb_build_object('id', withdrawl.id, 'hash', lnd_id), 21, true, now() + interval '10 seconds');

    RETURN withdrawl;
END;
$$;

CREATE OR REPLACE FUNCTION create_invoice(hash TEXT, bolt11 TEXT, expires_at timestamp(3) without time zone, msats_req INTEGER, user_id INTEGER)
RETURNS "Invoice"
LANGUAGE plpgsql
AS $$
DECLARE
    invoice "Invoice";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    INSERT INTO "Invoice" (hash, bolt11, "expiresAt", "msatsRequested", "userId", created_at, updated_at)
    VALUES (hash, bolt11, expires_at, msats_req, user_id, now_utc(), now_utc()) RETURNING * INTO invoice;

    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('checkInvoice', jsonb_build_object('hash', hash), 21, true, now() + interval '10 seconds');

    RETURN invoice;
END;
$$;