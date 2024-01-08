-- remove 'checkInvoice' job insertion since we're using LND subscriptions now
-- also allow function to take preimage as an argument
DROP FUNCTION IF EXISTS create_invoice(hash TEXT, bolt11 TEXT, expires_at timestamp(3) without time zone,
    msats_req BIGINT, user_id INTEGER, idesc TEXT, comment TEXT, lud18_data JSONB, inv_limit INTEGER, balance_limit_msats BIGINT);
CREATE OR REPLACE FUNCTION create_invoice(hash TEXT, preimage TEXT, bolt11 TEXT, expires_at timestamp(3) without time zone,
    msats_req BIGINT, user_id INTEGER, idesc TEXT, comment TEXT, lud18_data JSONB, inv_limit INTEGER, balance_limit_msats BIGINT)
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
    SELECT inv_limit > 0 AND count(*) >= inv_limit, COALESCE(sum("msatsRequested"), 0) INTO inv_limit_reached, inv_pending_msats
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
    INSERT INTO "Invoice" (hash, preimage, bolt11, "expiresAt", "msatsRequested", "userId", created_at, updated_at, "desc", comment, "lud18Data")
    VALUES (hash, preimage, bolt11, expires_at, msats_req, user_id, now_utc(), now_utc(), idesc, comment, lud18_data) RETURNING * INTO invoice;

    IF preimage IS NOT NULL THEN
        INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
        VALUES ('finalizeHodlInvoice', jsonb_build_object('hash', hash), 21, true, expires_at);
    END IF;

    RETURN invoice;
END;
$$;

-- remove 'checkWithdrawal' job insertion since we're using LND subscriptions now
CREATE OR REPLACE FUNCTION create_withdrawl(lnd_id TEXT, invoice TEXT, msats_amount BIGINT, msats_max_fee BIGINT, username TEXT)
RETURNS "Withdrawl"
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_msats BIGINT;
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

CREATE OR REPLACE FUNCTION check_invoices_and_withdrawals()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('checkPendingDeposits', '*/10 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('checkPendingWithdrawals', '*/10 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT check_invoices_and_withdrawals();
DROP FUNCTION check_invoices_and_withdrawals();