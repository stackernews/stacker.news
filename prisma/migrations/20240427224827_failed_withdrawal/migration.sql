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
    wdwl_pending_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    -- prevent too many pending invoices
    SELECT inv_limit > 0 AND count(*) >= inv_limit, COALESCE(sum("msatsRequested"), 0) INTO inv_limit_reached, inv_pending_msats
    FROM "Invoice"
    WHERE "userId" = user_id AND "expiresAt" > now_utc() AND "confirmedAt" IS NULL AND cancelled = false;

    IF inv_limit_reached THEN
        RAISE EXCEPTION 'SN_INV_PENDING_LIMIT';
    END IF;

    -- account for pending withdrawals
    SELECT COALESCE(sum("msatsPaying"), 0) + COALESCE(sum("msatsFeePaying"), 0) INTO wdwl_pending_msats
    FROM "Withdrawl"
    WHERE "userId" = user_id AND status IS NULL;

    -- prevent pending invoices + msats from exceeding the limit
    SELECT balance_limit_msats > 0 AND inv_pending_msats+wdwl_pending_msats+msats_req+msats > balance_limit_msats INTO balance_limit_reached
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