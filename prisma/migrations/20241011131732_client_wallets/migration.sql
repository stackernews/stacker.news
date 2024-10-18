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
ALTER TABLE "Wallet" ADD COLUMN     "canReceive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSend" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "WalletWebLn" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletWebLn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLNC" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLNC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBlink" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletBlink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletWebLn_walletId_key" ON "WalletWebLn"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNC_walletId_key" ON "WalletLNC"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBlink_walletId_key" ON "WalletBlink"("walletId");

-- AddForeignKey
ALTER TABLE "WalletWebLn" ADD CONSTRAINT "WalletWebLn_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLNC" ADD CONSTRAINT "WalletLNC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBlink" ADD CONSTRAINT "WalletBlink_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
