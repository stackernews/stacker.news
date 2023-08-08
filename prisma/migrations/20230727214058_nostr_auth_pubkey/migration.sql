/*
  Warnings:

  - A unique constraint covering the columns `[nostrAuthPubkey]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nostrAuthPubkey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users.nostrAuthPubkey_unique" ON "users"("nostrAuthPubkey");
