-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletType" ADD VALUE 'LNC';
ALTER TYPE "WalletType" ADD VALUE 'WEBLN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "vaultKeyHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "walletsUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VaultEntry" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "walletId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultEntry_walletId_idx" ON "VaultEntry"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultEntry_userId_key_key" ON "VaultEntry"("userId", "key");

-- CreateIndex
CREATE INDEX "Wallet_priority_idx" ON "Wallet"("priority");

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION wallet_updated_at_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "users"
    SET "walletsUpdatedAt" = NOW()
    WHERE "id" = CASE
        WHEN TG_OP = 'DELETE'
        THEN OLD."userId"
        ELSE NEW."userId"
    END;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wallet_updated_at_trigger
AFTER INSERT OR UPDATE OR DELETE ON "Wallet"
FOR EACH ROW EXECUTE PROCEDURE wallet_updated_at_trigger();

CREATE OR REPLACE TRIGGER vault_entry_updated_at_trigger
AFTER INSERT OR UPDATE OR DELETE ON "VaultEntry"
FOR EACH ROW EXECUTE PROCEDURE wallet_updated_at_trigger();
