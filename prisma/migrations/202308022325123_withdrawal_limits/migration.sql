DROP FUNCTION IF EXISTS create_withdrawl(TEXT, TEXT, INTEGER, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION create_withdrawl(lnd_id TEXT, invoice TEXT, msats_amount BIGINT, msats_max_fee BIGINT, username TEXT)
RETURNS "Withdrawl"
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_msats BIGINT;
    user_withdrawn BIGINT;
    withdrawl "Withdrawl";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats, id INTO user_msats, user_id FROM users WHERE name = username;
    IF (msats_amount + msats_max_fee) > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    SELECT COALESCE(SUM(CASE WHEN status IS NULL THEN "msatsPaying" + "msatsFeePaying" ELSE "msatsPaid" + "msatsFeePaid" END), 0) INTO user_withdrawn
    FROM "Withdrawl" WHERE "userId" = user_id AND (status IS NULL OR status = 'CONFIRMED') AND created_at >= now_utc() - '1 day'::interval;
    IF (user_withdrawn + msats_amount + msats_max_fee) > 1e9 THEN -- 1m sats daily withdrawal limit
        RAISE EXCEPTION 'SN_DAILY_WITHDRAWL_LIMIT_EXCEEDED';
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