-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'ZEBEDEE';

-- CreateTable
CREATE TABLE "WalletZebedee" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gamerTagId" TEXT,

    CONSTRAINT "WalletZebedee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletZebedee_walletId_key" ON "WalletZebedee"("walletId");

-- AddForeignKey
ALTER TABLE "WalletZebedee" ADD CONSTRAINT "WalletZebedee_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update wallet json
CREATE TRIGGER wallet_zebedee_as_jsonb
AFTER INSERT OR UPDATE ON "WalletZebedee"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();