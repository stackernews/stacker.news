-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'BOLT12';

-- CreateTable
CREATE TABLE "WalletBolt12" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offer" TEXT,

    CONSTRAINT "WalletBolt12_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletBolt12_walletId_key" ON "WalletBolt12"("walletId");

-- AddForeignKey
ALTER TABLE "WalletBolt12" ADD CONSTRAINT "WalletBolt12_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Update wallet json
CREATE TRIGGER wallet_blink_as_jsonb
AFTER INSERT OR UPDATE ON "WalletBolt12"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();