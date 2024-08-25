-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'LNC';

-- CreateTable
CREATE TABLE "WalletLNC" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pairingPhraseRecv" TEXT NOT NULL,
    "localKeyRecv" TEXT,
    "remoteKeyRecv" TEXT,
    "serverHostRecv" TEXT,
    CONSTRAINT "WalletLNC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNC_walletId_key" ON "WalletLNC"("walletId");

-- AddForeignKey
ALTER TABLE "WalletLNC" ADD CONSTRAINT "WalletLNC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_lnc_as_jsonb
AFTER INSERT OR UPDATE ON "WalletLNC"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();
