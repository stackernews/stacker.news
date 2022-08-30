CREATE OR REPLACE FUNCTION create_invoice(hash TEXT, bolt11 TEXT, expires_at timestamp(3) without time zone, msats_req INTEGER, user_id INTEGER)
RETURNS "Invoice"
LANGUAGE plpgsql
AS $$
DECLARE
    invoice "Invoice";
    limit_reached BOOLEAN;
    too_much BOOLEAN;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT count(*) >= 10, sum("msatsRequested")+max(users.msats)+msats_req > 1000000000 INTO limit_reached, too_much
    FROM "Invoice"
    JOIN users on "userId" = users.id
    WHERE "userId" = user_id AND "expiresAt" > now_utc() AND "confirmedAt" is null AND cancelled = false;

    -- prevent more than 10 pending invoices
    IF limit_reached THEN
        RAISE EXCEPTION 'SN_INV_PENDING_LIMIT';
    END IF;

    -- prevent pending invoices + msats from exceeding 1,000,000 sats
    IF too_much THEN
        RAISE EXCEPTION 'SN_INV_EXCEED_BALANCE';
    END IF;

    INSERT INTO "Invoice" (hash, bolt11, "expiresAt", "msatsRequested", "userId", created_at, updated_at)
    VALUES (hash, bolt11, expires_at, msats_req, user_id, now_utc(), now_utc()) RETURNING * INTO invoice;

    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('checkInvoice', jsonb_build_object('hash', hash), 21, true, now() + interval '10 seconds');

    RETURN invoice;
END;
$$;