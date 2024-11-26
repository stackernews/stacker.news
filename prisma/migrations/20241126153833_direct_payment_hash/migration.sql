/*
  Warnings:

  - A unique constraint covering the columns `[hash]` on the table `DirectPayment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hash` to the `DirectPayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DirectPayment" ADD COLUMN     "hash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DirectPayment_hash_key" ON "DirectPayment"("hash");
