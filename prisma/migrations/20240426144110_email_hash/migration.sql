/*
  Warnings:

  - A unique constraint covering the columns `[emailHash]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users.email_hash_unique" ON "users"("emailHash");

-- migrate existing emails to add email hashes
UPDATE "users"
SET "emailHash" = encode(digest("email", 'sha256'), 'hex')
WHERE "email" IS NOT NULL;

-- then wipe the email values
ALTER TABLE "users" DROP COLUMN "email";

-- and drop the corresponding index
DROP INDEX "users.email_unique";