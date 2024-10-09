/*
  Warnings:

  - A unique constraint covering the columns `[startedAt,userId,type]` on the table `Streak` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Streak.startedAt_userId_unique";

-- CreateIndex
CREATE UNIQUE INDEX "Streak_startedAt_userId_type_key" ON "Streak"("startedAt", "userId", "type");
