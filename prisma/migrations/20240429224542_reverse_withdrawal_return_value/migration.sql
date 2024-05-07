CREATE OR REPLACE FUNCTION reverse_withdrawl(wid INTEGER, wstatus "WithdrawlStatus")
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    msats_fee_paying BIGINT;
    msats_paying BIGINT;
    user_id INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    IF EXISTS (SELECT 1 FROM "Withdrawl" WHERE id = wid AND status IS NULL) THEN
        SELECT "msatsPaying", "msatsFeePaying", "userId" INTO msats_paying, msats_fee_paying, user_id
        FROM "Withdrawl" WHERE id = wid AND status IS NULL;

        UPDATE "Withdrawl" SET status = wstatus, updated_at = now_utc() WHERE id = wid AND status IS NULL;

        UPDATE users SET msats = msats + msats_paying + msats_fee_paying WHERE id = user_id;
        RETURN 0;
    END IF;
    RETURN 1;
END;
$$;
