/*
  Warnings:

  - You are about to drop the column `compound_id` on the `accounts` table. All the data in the column will be lost.
  - The `access_token_expires` column on the `accounts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `access_token` on the `sessions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[provider_id,provider_account_id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[identifier,token]` on the table `verification_requests` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "accounts.compound_id_unique";

-- DropIndex
DROP INDEX "accounts.provider_account_id_index";

-- DropIndex
DROP INDEX "accounts.provider_id_index";

-- DropIndex
DROP INDEX "sessions.access_token_unique";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "compound_id",
ADD COLUMN     "id_token" TEXT,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "session_state" TEXT,
ADD COLUMN     "token_type" TEXT;

ALTER TABLE accounts ALTER COLUMN "access_token_expires" TYPE TEXT USING CAST(extract(epoch FROM "access_token_expires") AS BIGINT)*1000;

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "access_token";

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_provider_account_id_key" ON "accounts"("provider_id", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests_identifier_token_key" ON "verification_requests"("identifier", "token");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
