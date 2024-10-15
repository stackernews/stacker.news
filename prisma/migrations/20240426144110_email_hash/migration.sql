/*
  Warnings:

  - A unique constraint covering the columns `[emailHash]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users.email_hash_unique" ON "users"("emailHash");

-- hack ... prisma doesn't know about our other schemas (e.g. pgboss)
-- and this is only really a problem on their "shadow database"
-- so we catch the exception it throws and ignore it
CREATE OR REPLACE FUNCTION submit_migrate_existing_user_emails_job() RETURNS void AS $$
    BEGIN
        -- Submit a job to salt and hash emails after the updated worker has spun-up
        INSERT INTO pgboss.job (name, data, priority, startafter, expirein)
        SELECT 'saltAndHashEmails', jsonb_build_object(), -100, now() + interval '10 minutes', interval '1 day';
    EXCEPTION WHEN OTHERS THEN
        -- catch the exception for prisma dev execution, but do nothing with it
    END;
$$ LANGUAGE plpgsql;

-- execute the function once to submit the one-time job
SELECT submit_migrate_existing_user_emails_job();
-- then drop it since we don't need it anymore
DROP FUNCTION submit_migrate_existing_user_emails_job();

-- function that accepts a salt and migrates all existing emails using the salt then hashing the salted email
CREATE OR REPLACE FUNCTION migrate_existing_user_emails(salt TEXT) RETURNS void AS $$
    BEGIN
        UPDATE "users"
        SET "emailHash" = encode(digest(LOWER("email") || salt, 'sha256'), 'hex')
        WHERE "email" IS NOT NULL;

        -- then wipe the email values
        UPDATE "users"
        SET email = NULL;

    END;
$$ LANGUAGE plpgsql;
