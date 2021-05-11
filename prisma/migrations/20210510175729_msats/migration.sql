/*
  Warnings:

  - You are about to drop the column `requested` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `received` on the `Invoice` table. All the data in the column will be lost.
  - Added the required column `msatsRequested` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "requested",
DROP COLUMN "received",
ADD COLUMN     "msatsRequested" INTEGER NOT NULL,
ADD COLUMN     "msatsReceived" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "msats" INTEGER NOT NULL DEFAULT 0;
