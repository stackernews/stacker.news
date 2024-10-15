-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "outlawed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Sub" ADD COLUMN     "moderated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderatedCount" INTEGER NOT NULL DEFAULT 0;
