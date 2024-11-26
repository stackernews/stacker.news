/*
  Warnings:

  - Added the required column `msats` to the `DirectPayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DirectPayment" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "desc" TEXT,
ADD COLUMN     "lud18Data" JSONB,
ADD COLUMN     "msats" BIGINT NOT NULL;
