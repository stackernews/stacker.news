-- AlterTable
ALTER TABLE "users" ADD COLUMN     "noteWithdrawals" BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION confirm_withdrawl(wid INTEGER, msats_paid BIGINT, msats_fee_paid BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    msats_fee_paying BIGINT;
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
        RETURN 0;
    END IF;

    RETURN 1;
END;
$$;