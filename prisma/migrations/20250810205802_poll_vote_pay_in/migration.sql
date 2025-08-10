-- AlterTable
ALTER TABLE "PollBlindVote" ADD COLUMN     "payInId" INTEGER;

-- AlterTable
ALTER TABLE "PollVote" ADD COLUMN     "payInId" INTEGER;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollBlindVote" ADD CONSTRAINT "PollBlindVote_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
