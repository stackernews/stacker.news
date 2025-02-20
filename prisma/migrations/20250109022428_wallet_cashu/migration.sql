-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'CASHU';

-- CreateTable
CREATE TABLE "WalletCashu" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mintUrl" TEXT NOT NULL,

    CONSTRAINT "WalletCashu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletCashu_walletId_key" ON "WalletCashu"("walletId");

-- AddForeignKey
ALTER TABLE "WalletCashu" ADD CONSTRAINT "WalletCashu_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_cashu_as_jsonb
AFTER INSERT OR UPDATE ON "WalletCashu"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();