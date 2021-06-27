/*
  Warnings:

  - A unique constraint covering the columns `[pubkey]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pubkey" TEXT;

-- CreateTable
CREATE TABLE "LnAuth" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "k1" TEXT NOT NULL,
    "pubkey" TEXT,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LnAuth.k1_unique" ON "LnAuth"("k1");

-- CreateIndex
CREATE UNIQUE INDEX "users.pubkey_unique" ON "users"("pubkey");
