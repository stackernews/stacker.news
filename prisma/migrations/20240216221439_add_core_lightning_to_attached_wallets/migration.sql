ALTER TYPE "WalletType" ADD VALUE 'CORE_LIGHTNING';

CREATE TABLE "WalletCoreLightning" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "socket" TEXT NOT NULL,
    "rune" TEXT NOT NULL,

    CONSTRAINT "WalletCoreLightning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletCoreLightning_walletId_key" ON "WalletCoreLightning"("walletId");

ALTER TABLE "WalletCoreLightning" ADD CONSTRAINT "WalletCoreLightning_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_core_lightning_as_jsonb
AFTER INSERT OR UPDATE ON "WalletCoreLightning"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();
