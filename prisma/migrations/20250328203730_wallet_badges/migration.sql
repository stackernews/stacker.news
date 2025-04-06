ALTER TABLE "users"
    ADD COLUMN     "hasRecvWallet" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN     "hasSendWallet" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Streak"
    ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMP(3),
    ALTER COLUMN "endedAt" SET DATA TYPE TIMESTAMP(3);

CREATE OR REPLACE FUNCTION wallet_recv_badge_trigger() RETURNS TRIGGER AS $$
DECLARE
    user_id INTEGER;
    old_has_recv_wallet BOOLEAN;
    new_has_recv_wallet BOOLEAN;
BEGIN
    -- if TG_OP is DELETE, then NEW.userId is NULL
    user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."userId" ELSE NEW."userId" END;

    SELECT "hasRecvWallet" INTO old_has_recv_wallet
    FROM "users"
    WHERE "id" = user_id;

    UPDATE "users"
    SET "hasRecvWallet" = EXISTS (
        SELECT 1
        FROM "Wallet"
        WHERE "userId" = user_id
        AND "wallet" IS NOT NULL
        AND "enabled" = true
    )
    WHERE "id" = user_id
    RETURNING "hasRecvWallet" INTO new_has_recv_wallet;

    -- XXX horses and guns used to be streaks
    -- so we continue to use the Streak table to fetch notifications for them.
    IF old_has_recv_wallet = false AND new_has_recv_wallet = true THEN
        INSERT INTO "Streak" ("userId", "startedAt", "type", created_at, updated_at)
        VALUES (user_id, now_utc(), 'HORSE', now_utc(), now_utc());
    ELSIF old_has_recv_wallet = true AND new_has_recv_wallet = false THEN
        UPDATE "Streak"
        SET "endedAt" = now_utc(), updated_at = now_utc()
        WHERE "userId" = user_id
        AND "type" = 'HORSE'
        AND "endedAt" IS NULL;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wallet_recv_badge_trigger
AFTER INSERT OR UPDATE OR DELETE ON "Wallet"
FOR EACH ROW EXECUTE PROCEDURE wallet_recv_badge_trigger();

CREATE OR REPLACE FUNCTION wallet_send_badge_trigger() RETURNS TRIGGER AS $$
DECLARE
    user_id INTEGER;
    old_has_send_wallet BOOLEAN;
    new_has_send_wallet BOOLEAN;
BEGIN
    user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."userId" ELSE NEW."userId" END;

    SELECT "hasSendWallet" INTO old_has_send_wallet
    FROM "users"
    WHERE "id" = user_id;

    UPDATE "users"
    SET "hasSendWallet" = EXISTS (
        SELECT 1
        FROM "Wallet"
        JOIN "VaultEntry" ON "Wallet"."id" = "VaultEntry"."walletId"
        WHERE "VaultEntry"."userId" = user_id
        AND "VaultEntry"."value" IS NOT NULL
        AND "Wallet"."enabled" = true
    )
    WHERE "id" = user_id
    RETURNING "hasSendWallet" INTO new_has_send_wallet;

    IF old_has_send_wallet = false AND new_has_send_wallet = true THEN
        INSERT INTO "Streak" ("userId", "startedAt", "type", created_at, updated_at)
        VALUES (user_id, now_utc(), 'GUN', now_utc(), now_utc());
    ELSIF old_has_send_wallet = true AND new_has_send_wallet = false THEN
        UPDATE "Streak"
        SET "endedAt" = now_utc(), updated_at = now_utc()
        WHERE "userId" = user_id
        AND "type" = 'GUN'
        AND "endedAt" IS NULL;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wallet_send_badge_trigger
AFTER INSERT OR UPDATE OR DELETE ON "VaultEntry"
FOR EACH ROW EXECUTE PROCEDURE wallet_send_badge_trigger();
