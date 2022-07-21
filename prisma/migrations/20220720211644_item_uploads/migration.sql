/*
  Warnings:

  - A unique constraint covering the columns `[itemId]` on the table `Upload` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "uploadId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Upload.itemId_unique" ON "Upload"("itemId");
