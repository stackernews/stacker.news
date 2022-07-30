-- AlterEnum
ALTER TYPE "ItemActType" ADD VALUE 'POLL';

-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'POLL';

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "pollCost" INTEGER;

-- CreateTable
CREATE TABLE "PollOption" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "option" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "pollOptionId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollOption.itemId_index" ON "PollOption"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote.itemId_userId_unique" ON "PollVote"("itemId", "userId");

-- CreateIndex
CREATE INDEX "PollVote.userId_index" ON "PollVote"("userId");

-- CreateIndex
CREATE INDEX "PollVote.pollOptionId_index" ON "PollVote"("pollOptionId");

-- AddForeignKey
ALTER TABLE "PollOption" ADD FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD FOREIGN KEY ("pollOptionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
