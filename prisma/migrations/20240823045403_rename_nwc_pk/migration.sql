/*
  Warnings:

  - The primary key for the `WalletNWC` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `int` on the `WalletNWC` table. All the data in the column will be lost.

*/

-- AlterTable
ALTER TABLE "WalletNWC" RENAME COLUMN "int" TO "id";

UPDATE "Wallet"
SET wallet = to_jsonb("WalletNWC")
FROM "WalletNWC"
WHERE "Wallet".id = "WalletNWC"."walletId";
