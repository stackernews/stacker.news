-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'NWC';

-- CreateTable
CREATE TABLE "WalletNWC" (
    "int" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nwcUrlRecv" TEXT NOT NULL,

    CONSTRAINT "WalletNWC_pkey" PRIMARY KEY ("int")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletNWC_walletId_key" ON "WalletNWC"("walletId");

-- AddForeignKey
ALTER TABLE "WalletNWC" ADD CONSTRAINT "WalletNWC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_nwc_as_jsonb
AFTER INSERT OR UPDATE ON "WalletNWC"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();
