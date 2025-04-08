ALTER TABLE "users"
    ADD COLUMN     "hasRecvWallet" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN     "hasSendWallet" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Streak"
    ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMP(3),
    ALTER COLUMN "endedAt" SET DATA TYPE TIMESTAMP(3);

CREATE OR REPLACE FUNCTION check_wallet_trigger() RETURNS TRIGGER AS $$
DECLARE
    user_id INTEGER;
BEGIN
    -- if TG_OP is DELETE, then NEW.userId is NULL
    user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."userId" ELSE NEW."userId" END;

    INSERT INTO pgboss.job (name, data, retrylimit, startafter, keepuntil)
    VALUES (
        'checkWallet',
        jsonb_build_object('userId', user_id),
        21, now(), now() + interval '5 minutes');

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER check_wallet_trigger
AFTER INSERT OR UPDATE OR DELETE ON "Wallet"
FOR EACH ROW EXECUTE PROCEDURE check_wallet_trigger();
