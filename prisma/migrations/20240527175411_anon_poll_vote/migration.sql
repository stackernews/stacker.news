-- CreateTable
CREATE TABLE "PollBlindVote" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PollBlindVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollBlindVote.userId_index" ON "PollBlindVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PollBlindVote.itemId_userId_unique" ON "PollBlindVote"("itemId", "userId");

-- AddForeignKey
ALTER TABLE "PollBlindVote" ADD CONSTRAINT "PollBlindVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollBlindVote" ADD CONSTRAINT "PollBlindVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- migrate existing poll votes
INSERT INTO "PollBlindVote" ("itemId", "userId")
  SELECT "itemId", "userId" FROM "PollVote";

/*
  Warnings:

  - You are about to drop the column `userId` on the `PollVote` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_userId_fkey";

-- DropIndex
DROP INDEX "PollVote.itemId_userId_unique";

-- DropIndex
DROP INDEX "PollVote.userId_index";

-- AlterTable
ALTER TABLE "PollVote" DROP COLUMN "userId";

-- update `poll_vote` function to update both "PollVote" and "PollBlindVote" tables
-- create poll vote
-- if user hasn't already voted
-- charges user item.pollCost
-- adds POLL to ItemAct
-- adds PollVote
-- adds PollBlindVote
CREATE OR REPLACE FUNCTION poll_vote(option_id INTEGER, user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option "PollOption";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT * INTO option FROM "PollOption" where id = option_id;
    IF option IS NULL THEN
        RAISE EXCEPTION 'INVALID_POLL_OPTION';
    END IF;

    SELECT * INTO item FROM "Item" where id = option."itemId";
    IF item IS NULL THEN
        RAISE EXCEPTION 'POLL_DOES_NOT_EXIST';
    END IF;

    IF item."userId" = user_id THEN
        RAISE EXCEPTION 'POLL_OWNER_CANT_VOTE';
    END IF;

    -- no longer check `PollVote` to see if a user has voted. Instead, check `PollBlindVote`
    IF EXISTS (SELECT 1 FROM "PollBlindVote" WHERE "itemId" = item.id AND "userId" = user_id) THEN
        RAISE EXCEPTION 'POLL_VOTE_ALREADY_EXISTS';
    END IF;

    PERFORM item_act(item.id, user_id, 'POLL', item."pollCost");

    INSERT INTO "PollVote" (created_at, updated_at, "itemId", "pollOptionId")
        VALUES (now_utc(), now_utc(), item.id, option_id);

    INSERT INTO "PollBlindVote" (created_at, updated_at, "itemId", "userId")
        VALUES (now_utc(), now_utc(), item.id, user_id);

    RETURN item;
END;
$$;
