/*
  Warnings:

  - You are about to drop the `WalletBlink` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletLNC` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletWebLn` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WalletBlink" DROP CONSTRAINT "WalletBlink_walletId_fkey";

-- DropForeignKey
ALTER TABLE "WalletLNC" DROP CONSTRAINT "WalletLNC_walletId_fkey";

-- DropForeignKey
ALTER TABLE "WalletWebLn" DROP CONSTRAINT "WalletWebLn_walletId_fkey";

-- DropTable
DROP TABLE "WalletBlink";

-- DropTable
DROP TABLE "WalletLNC";

-- DropTable
DROP TABLE "WalletWebLn";
