-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastCheckedJobs" TIMESTAMP(3),
ADD COLUMN     "noteJobIndicator" BOOLEAN NOT NULL DEFAULT true;
