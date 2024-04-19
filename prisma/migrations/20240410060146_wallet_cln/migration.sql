-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'CLN';

-- CreateTable
CREATE TABLE "WalletCLN" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "socket" TEXT NOT NULL,
    "rune" TEXT NOT NULL,
    "cert" TEXT,

    CONSTRAINT "WalletCLN_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletCLN_walletId_key" ON "WalletCLN"("walletId");

-- AddForeignKey
ALTER TABLE "WalletCLN" ADD CONSTRAINT "WalletCLN_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_cln_as_jsonb
AFTER INSERT OR UPDATE ON "WalletCLN"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();
