/*
  Warnings:

  - You are about to drop the column `apiKey` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[apiKeyHash]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "users.apikey_unique";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "apiKey",
ADD COLUMN     "apiKeyHash" CHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "users.apikeyhash_unique" ON "users"("apiKeyHash");
