/*
  Warnings:

  - You are about to drop the column `itemId` on the `Upload` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_itemId_fkey";

-- DropIndex
DROP INDEX "Upload.itemId_index";

-- DropIndex
DROP INDEX "Upload.itemId_unique";

-- AlterTable
ALTER TABLE "Upload" DROP COLUMN "itemId",
ADD COLUMN     "paid" BOOLEAN;
