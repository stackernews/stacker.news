-- AlterTable
ALTER TABLE "Sub" ADD COLUMN IF NOT EXISTS "desc" TEXT;

UPDATE "Sub" SET "desc" = 'jobs at bitcoin and lightning companies' WHERE name = 'jobs';