-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletType" ADD VALUE 'BLINK';
ALTER TYPE "WalletType" ADD VALUE 'LNC';
ALTER TYPE "WalletType" ADD VALUE 'WEBLN';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "canReceive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canSend" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "vaultKeyHash" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "VaultEntry" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "walletId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultEntry_userId_idx" ON "VaultEntry"("userId");

-- CreateIndex
CREATE INDEX "VaultEntry_walletId_idx" ON "VaultEntry"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultEntry_userId_key_walletId_key" ON "VaultEntry"("userId", "key", "walletId");

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
