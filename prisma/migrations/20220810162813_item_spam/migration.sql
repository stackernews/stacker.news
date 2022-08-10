-- AlterTable
ALTER TABLE "Item" ADD COLUMN "paidImgLink" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "freePosts" SET DEFAULT 0;