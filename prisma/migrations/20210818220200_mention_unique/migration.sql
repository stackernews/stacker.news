/*
  Warnings:

  - A unique constraint covering the columns `[itemId,userId]` on the table `Mention` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Mention.itemId_userId_unique" ON "Mention"("itemId", "userId");
