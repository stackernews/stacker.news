-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'BLINK';

-- CreateTable
CREATE TABLE "WalletBlink" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apiKeyRecv" TEXT NOT NULL,
    "currencyRecv" TEXT,

    CONSTRAINT "WalletBlink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletBlink_walletId_key" ON "WalletBlink"("walletId");

-- AddForeignKey
ALTER TABLE "WalletBlink" ADD CONSTRAINT "WalletBlink_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Update wallet json
CREATE TRIGGER wallet_blink_as_jsonb
AFTER INSERT OR UPDATE ON "WalletBlink"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();