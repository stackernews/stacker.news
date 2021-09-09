/*
  Warnings:

  - You are about to drop the `Vote` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ItemActType" AS ENUM ('VOTE', 'BOOST', 'TIP');

-- DropForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_userId_fkey";

ALTER TABLE "Vote" RENAME TO "ItemAct";

ALTER TABLE "ItemAct" RENAME COLUMN "boost" TO "act";

ALTER TABLE "ItemAct"
  ALTER COLUMN "act" DROP DEFAULT,
  ALTER COLUMN "act" SET DATA TYPE "ItemActType"
    USING (
      CASE
        WHEN "act" THEN 'BOOST'
        ELSE 'VOTE'
      END
    )::"ItemActType";

-- CreateIndex
CREATE INDEX "ItemAct.itemId_index" ON "ItemAct"("itemId");

-- CreateIndex
CREATE INDEX "ItemAct.userId_index" ON "ItemAct"("userId");

-- CreateIndex
CREATE INDEX "ItemAct.act_index" ON "ItemAct"("act");

-- AddForeignKey
ALTER TABLE "ItemAct" ADD FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAct" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION item_act(item_id INTEGER, user_id INTEGER, act "ItemActType", act_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_sats INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT (msats / 1000) INTO user_sats FROM users WHERE id = user_id;
    IF act_sats > user_sats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - (act_sats * 1000) WHERE id = user_id;

    CASE act
      when 'VOTE', 'BOOST' then
        -- if we've already voted, then this is boost (doing this here prevents any potential
        -- race)
        IF EXISTS (SELECT 1 FROM "ItemAct" WHERE "itemId" = item_id AND "userId" = user_id) THEN
            INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_sats, item_id, user_id, 'BOOST', now_utc(), now_utc());

        -- this is a vote
        ELSE
          -- only 1 sat votes are allowed
          IF act_sats > 1 THEN
            RAISE EXCEPTION 'SN_EXCEEDS_ACT_SAT_LIMIT';
          END IF;

          INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (1, item_id, user_id, 'VOTE', now_utc(), now_utc());

          -- give the item's user 1 sat
          UPDATE users SET msats = msats + 1000 WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);
        END IF;
      when 'TIP' then
        INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_sats, item_id, user_id, 'TIP', now_utc(), now_utc());
        -- give the item's user act_sats
        UPDATE users SET msats = msats + (act_sats * 1000) WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);
    END case;

    RETURN act_sats;
END;
$$;

-- make sure we nuke the old versions
DROP FUNCTION create_item(text,text,text,integer,text);

CREATE OR REPLACE FUNCTION create_item(title TEXT, url TEXT, text TEXT, parent_id INTEGER, user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_sats INTEGER;
    free_posts INTEGER;
    free_comments INTEGER;
    freebie BOOLEAN;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT (msats / 1000), "freePosts", "freeComments"
    INTO user_sats, free_posts, free_comments
    FROM users WHERE id = user_id;

    freebie := (parent_id IS NULL AND free_posts > 0) OR (parent_id IS NOT NULL AND free_comments > 0);

    IF NOT freebie AND 1 > user_sats  THEN
      RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    INSERT INTO "Item" (title, url, text, "userId", "parentId", created_at, updated_at)
    VALUES (title, url, text, user_id, parent_id, now_utc(), now_utc()) RETURNING * INTO item;

    IF freebie THEN
        IF parent_id IS NULL THEN
            UPDATE users SET "freePosts" = "freePosts" - 1 WHERE id = user_id;
        ELSE
            UPDATE users SET "freeComments" = "freeComments" - 1 WHERE id = user_id;
        END IF;
    ELSE
        UPDATE users SET msats = msats - 1000 WHERE id = user_id;

        INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
        VALUES (1, item.id, user_id, 'VOTE', now_utc(), now_utc());
    END IF;

    RETURN item;
END;
$$;