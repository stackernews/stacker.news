-- AlterTable
ALTER TABLE "Sub" ADD COLUMN     "desc" TEXT;

UPDATE "Sub" SET desc = 'jobs at bitcoin and lightning companies' WHERE name = 'jobs';