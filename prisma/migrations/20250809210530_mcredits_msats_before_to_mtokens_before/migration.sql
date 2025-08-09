/*
  Warnings:

  - You are about to drop the column `mcreditsBefore` on the `PayIn` table. All the data in the column will be lost.
  - You are about to drop the column `msatsBefore` on the `PayIn` table. All the data in the column will be lost.
  - You are about to drop the column `mcreditsBefore` on the `PayOutCustodialToken` table. All the data in the column will be lost.
  - You are about to drop the column `msatsBefore` on the `PayOutCustodialToken` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PayIn" DROP COLUMN "mcreditsBefore",
DROP COLUMN "msatsBefore";

-- AlterTable
ALTER TABLE "PayInCustodialToken" ADD COLUMN     "mtokensBefore" BIGINT;

-- AlterTable
ALTER TABLE "PayOutCustodialToken" DROP COLUMN "mcreditsBefore",
DROP COLUMN "msatsBefore",
ADD COLUMN     "mtokensBefore" BIGINT;
