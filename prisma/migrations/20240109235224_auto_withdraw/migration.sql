-- AlterTable
ALTER TABLE "Withdrawl" ADD COLUMN     "autoWithdraw" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "autoWithdrawMaxFeePercent" DOUBLE PRECISION,
ADD COLUMN     "autoWithdrawThreshold" INTEGER,
ADD COLUMN     "lnAddr" TEXT;

CREATE OR REPLACE FUNCTION user_auto_withdraw() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data)
    SELECT 'autoWithdraw', jsonb_build_object('id', NEW.id)
    -- only if there isn't already a pending job for this user
    WHERE NOT EXISTS (
        SELECT *
        FROM pgboss.job
        WHERE name = 'autoWithdraw'
        AND data->>'id' = NEW.id::TEXT
        AND state = 'created'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_auto_withdraw_trigger ON users;
CREATE TRIGGER user_auto_withdraw_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (
        NEW."autoWithdrawThreshold" IS NOT NULL
        AND NEW."autoWithdrawMaxFeePercent" IS NOT NULL
        AND NEW."lnAddr" IS NOT NULL
        -- in excess of at least 10% of the threshold
        AND NEW.msats - (NEW."autoWithdrawThreshold" * 1000) >= NEW."autoWithdrawThreshold" * 1000 * 0.1)
    EXECUTE PROCEDURE user_auto_withdraw();

DROP FUNCTION IF EXISTS create_withdrawl(TEXT, TEXT, BIGINT, BIGINT, TEXT);
CREATE OR REPLACE FUNCTION create_withdrawl(lnd_id TEXT, invoice TEXT, msats_amount BIGINT, msats_max_fee BIGINT, username TEXT, auto_withdraw BOOLEAN)
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

    INSERT INTO "Withdrawl" (hash, bolt11, "msatsPaying", "msatsFeePaying", "userId", "autoWithdraw", created_at, updated_at)
    VALUES (lnd_id, invoice, msats_amount, msats_max_fee, user_id, auto_withdraw, now_utc(), now_utc()) RETURNING * INTO withdrawl;

    UPDATE users SET msats = msats - msats_amount - msats_max_fee WHERE id = user_id;

    RETURN withdrawl;
END;
$$;
