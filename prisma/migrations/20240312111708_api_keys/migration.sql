/*
  Warnings:

  - A unique constraint covering the columns `[apiKey]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "apiKey" CHAR(32),
ADD COLUMN     "apiKeyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "users.apikey_unique" ON "users"("apiKey");
