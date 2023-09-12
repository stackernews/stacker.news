-- AlterTable
ALTER TABLE "users" ADD COLUMN "hideWelcomeBanner" BOOLEAN NOT NULL DEFAULT true, ALTER COLUMN "hideWelcomeBanner" SET DEFAULT false;
