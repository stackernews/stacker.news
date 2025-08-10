/*
  Warnings:

  - You are about to drop the column `payInId` on the `PollBlindVote` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[payInId]` on the table `PollVote` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "PollBlindVote" DROP CONSTRAINT "PollBlindVote_payInId_fkey";

-- AlterTable
ALTER TABLE "PollBlindVote" DROP COLUMN "payInId";

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_payInId_key" ON "PollVote"("payInId");
