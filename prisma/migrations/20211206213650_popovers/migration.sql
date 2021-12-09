-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tipPopover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "upvotePopover" BOOLEAN NOT NULL DEFAULT false;
