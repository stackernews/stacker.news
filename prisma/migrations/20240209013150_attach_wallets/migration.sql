-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('LIGHTNING_ADDRESS', 'LND');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "label" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "type" "WalletType" NOT NULL,
    "wallet" JSONB,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLightningAddress" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address" TEXT NOT NULL,

    CONSTRAINT "WalletLightningAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLND" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "socket" TEXT NOT NULL,
    "macaroon" TEXT NOT NULL,
    "cert" TEXT,

    CONSTRAINT "WalletLND_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLightningAddress_walletId_key" ON "WalletLightningAddress"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLND_walletId_key" ON "WalletLND"("walletId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLightningAddress" ADD CONSTRAINT "WalletLightningAddress_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLND" ADD CONSTRAINT "WalletLND_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTriggers to update wallet column in Wallet table
CREATE OR REPLACE FUNCTION wallet_wallet_type_as_jsonb()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE "Wallet"
    SET wallet = to_jsonb(NEW)
    WHERE id = NEW."walletId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_lnaddr_as_jsonb
AFTER INSERT OR UPDATE ON "WalletLightningAddress"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();

CREATE TRIGGER wallet_lnd_as_jsonb
AFTER INSERT OR UPDATE ON "WalletLND"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();

-- migrate lnaddr from users to use wallet table
-- we leave the lnaddr column in users for now to avoid breaking production on deploy
WITH users AS (
    SELECT users.id AS "userId", "lnAddr"
    FROM users
    WHERE "lnAddr" IS NOT NULL
),
wallets AS (
    INSERT INTO "Wallet" ("userId", "type")
    SELECT "userId", 'LIGHTNING_ADDRESS'
    FROM users
    RETURNING *
)
INSERT INTO "WalletLightningAddress" ("walletId", "address")
SELECT wallets.id, users."lnAddr"
FROM users
JOIN wallets ON users."userId" = wallets."userId";

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
    )
    -- and they have an attached wallet (currently all are received only)
    AND EXISTS (
        SELECT *
        FROM "Wallet"
        WHERE "userId" = NEW.id
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
        -- in excess of at least 10% of the threshold
        AND NEW.msats - (NEW."autoWithdrawThreshold" * 1000) >= NEW."autoWithdrawThreshold" * 1000 * 0.1)
    EXECUTE PROCEDURE user_auto_withdraw();