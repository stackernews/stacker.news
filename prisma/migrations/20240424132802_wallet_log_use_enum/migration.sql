/*
  Warnings:

  - Changed the type of `wallet` on the `WalletLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/

UPDATE "WalletLog"
SET wallet = CASE
    WHEN wallet = 'walletLND' THEN 'LND'
    WHEN wallet = 'walletCLN' THEN 'CLN'
    WHEN wallet = 'walletLightningAddress' THEN 'LIGHTNING_ADDRESS'
    ELSE wallet
END;

-- AlterTable
ALTER TABLE "WalletLog" ALTER COLUMN "wallet" TYPE "WalletType" USING "wallet"::"WalletType";
