-- AlterTable
ALTER TABLE "users" ADD COLUMN     "showMutedUsers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showSubscribedUsers" BOOLEAN NOT NULL DEFAULT false;
