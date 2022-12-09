-- CreateEnum
CREATE TYPE "EarnType" AS ENUM ('POST', 'COMMENT', 'TIP_COMMENT', 'TIP_POST');

-- AlterTable
ALTER TABLE "Earn" ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "type" "EarnType",
ADD COLUMN     "typeId" INTEGER;

-- CreateIndex
CREATE INDEX "Earn.created_at_userId_index" ON "Earn"("created_at", "userId");
