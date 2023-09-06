-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hideIsContributor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isContributor" BOOLEAN NOT NULL DEFAULT false;
