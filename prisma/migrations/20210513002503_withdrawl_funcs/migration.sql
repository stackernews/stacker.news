CREATE OR REPLACE FUNCTION create_withdrawl(lnd_id TEXT, invoice TEXT, msats_amount INTEGER, msats_max_fee INTEGER, username TEXT)
RETURNS "Withdrawl"
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    user_msats INTEGER;
    withdrawl "Withdrawl";
BEGIN
    SELECT msats, id INTO user_msats, user_id FROM users WHERE name = username;
    IF (msats_amount + msats_max_fee) > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    INSERT INTO "Withdrawl" (hash, bolt11, "msatsPaying", "msatsFeePaying", "userId", updated_at)
    VALUES (lnd_id, invoice, msats_amount, msats_max_fee, user_id, 'now') RETURNING * INTO withdrawl;

    UPDATE users SET msats = msats - msats_amount - msats_max_fee WHERE id = user_id;

    RETURN withdrawl;
END;
$$;

CREATE OR REPLACE FUNCTION confirm_withdrawl(lnd_id TEXT, msats_paid INTEGER, msats_fee_paid INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE

BEGIN

END;
$$;

CREATE OR REPLACE FUNCTION reverse_withdrawl(lnd_id TEXT, msats_paid INTEGER, msats_fee_paid INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE

BEGIN

END;
$$;