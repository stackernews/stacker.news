/*
  Warnings:

  - The primary key for the `WalletLNbits` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `int` on the `WalletLNbits` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WalletLNbits" RENAME COLUMN "int" TO "id";

UPDATE "Wallet"
SET wallet = to_jsonb(NEW)
WHERE id IN (
  SELECT "walletId" FROM "WalletLNbits"
)
