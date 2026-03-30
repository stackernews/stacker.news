-- fix trigger when wallet is deleted
CREATE OR REPLACE FUNCTION wallet_updated_at_trigger() RETURNS TRIGGER AS $$
DECLARE
    user_id INT;
BEGIN
    IF TG_TABLE_NAME = 'WalletProtocol' THEN
        SELECT w."userId" INTO user_id
        FROM "Wallet" w
        WHERE w.id = CASE
            WHEN TG_OP = 'DELETE' THEN OLD."walletId"
            ELSE NEW."walletId"
        END;
    ELSE
        user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."userId" ELSE NEW."userId" END;
    END IF;

    UPDATE "users" u
    SET "walletsUpdatedAt" = NOW()
    WHERE u.id = user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
