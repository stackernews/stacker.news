-- AlterTable
ALTER TABLE "users"
    ADD COLUMN     "hasRecvWallet" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN     "hasSendWallet" BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION wallet_recv_badge_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "users"
    SET "hasRecvWallet" = EXISTS (
        SELECT 1
        FROM "Wallet"
        WHERE "userId" = COALESCE(NEW."userId", OLD."userId")
        AND "wallet" IS NOT NULL
        AND "enabled" = true
    )
    WHERE "id" = COALESCE(NEW."userId", OLD."userId");
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wallet_recv_badge_trigger
AFTER INSERT OR UPDATE OR DELETE ON "Wallet"
FOR EACH ROW EXECUTE PROCEDURE wallet_recv_badge_trigger();

CREATE OR REPLACE FUNCTION wallet_send_badge_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "users"
    SET "hasSendWallet" = EXISTS (
        SELECT 1
        FROM "Wallet"
        JOIN "VaultEntry" ON "Wallet"."id" = "VaultEntry"."walletId"
        WHERE "VaultEntry"."userId" = COALESCE(NEW."userId", OLD."userId")
        AND "VaultEntry"."value" IS NOT NULL
        AND "Wallet"."enabled" = true
    )
    WHERE "id" = COALESCE(NEW."userId", OLD."userId");
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wallet_send_badge_trigger
AFTER INSERT OR UPDATE OR DELETE ON "VaultEntry"
FOR EACH ROW EXECUTE PROCEDURE wallet_send_badge_trigger();
