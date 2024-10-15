-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hideGithub" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hideNostr" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hideTwitter" BOOLEAN NOT NULL DEFAULT true;
