-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'LNBITS';

-- CreateTable
CREATE TABLE "WalletLNbits" (
    "int" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "invoiceKey" TEXT NOT NULL,

    CONSTRAINT "WalletLNbits_pkey" PRIMARY KEY ("int")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNbits_walletId_key" ON "WalletLNbits"("walletId");

-- AddForeignKey
ALTER TABLE "WalletLNbits" ADD CONSTRAINT "WalletLNbits_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_lnbits_as_jsonb
AFTER INSERT OR UPDATE ON "WalletLNbits"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();
