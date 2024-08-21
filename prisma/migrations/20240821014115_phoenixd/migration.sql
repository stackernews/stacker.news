-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'PHOENIXD';

-- CreateTable
CREATE TABLE "WalletPhoenixd" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "secondaryPassword" TEXT NOT NULL,

    CONSTRAINT "WalletPhoenixd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletPhoenixd_walletId_key" ON "WalletPhoenixd"("walletId");

-- AddForeignKey
ALTER TABLE "WalletPhoenixd" ADD CONSTRAINT "WalletPhoenixd_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_phoenixd_as_jsonb
AFTER INSERT OR UPDATE ON "WalletPhoenixd"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();
