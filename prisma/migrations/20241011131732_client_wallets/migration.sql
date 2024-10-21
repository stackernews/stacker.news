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
