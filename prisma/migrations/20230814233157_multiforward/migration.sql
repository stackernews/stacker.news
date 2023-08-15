-- CreateTable
CREATE TABLE "ItemForward" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "pct" INTEGER NOT NULL,

    CONSTRAINT "ItemForward_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ItemForward" ADD CONSTRAINT "ItemForward_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemForward" ADD CONSTRAINT "ItemForward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ItemForward.itemId_index" ON "ItemForward"("itemId");

-- Type used in create_item below for JSON processing
CREATE TYPE ItemForwardType as ("userId" INTEGER, "pct" INTEGER);

-- Migrate existing forward entries to the ItemForward table
-- All migrated entries will get 100% sats by default
INSERT INTO "ItemForward" ("itemId", "userId", "pct")
    SELECT "id" AS "itemId", "fwdUserId", 100 FROM "Item" WHERE "fwdUserId" IS NOT NULL;

-- Remove the existing fwdUserId column now that existing forwards have been migrated
-- ALTER TABLE "Item" DROP COLUMN "fwdUserId";

-- Delete old create_item function
DROP FUNCTION IF EXISTS create_item(
    sub TEXT, title TEXT, url TEXT, text TEXT, boost INTEGER, bounty INTEGER,
    parent_id INTEGER, user_id INTEGER, forward INTEGER,
    spam_within INTERVAL);

-- Update to create ItemForward entries accordingly
CREATE OR REPLACE FUNCTION create_item(
    sub TEXT, title TEXT, url TEXT, text TEXT, boost INTEGER, bounty INTEGER,
    parent_id INTEGER, user_id INTEGER, forward JSON,
    spam_within INTERVAL)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    cost_msats BIGINT;
    freebie BOOLEAN;
    item "Item";
    med_votes FLOAT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats INTO user_msats FROM users WHERE id = user_id;

    cost_msats := 1000 * POWER(10, item_spam(parent_id, user_id, spam_within));
    -- it's only a freebie if it's a 1 sat cost, they have < 1 sat, and boost = 0
    freebie := (cost_msats <= 1000) AND (user_msats < 1000) AND (boost = 0);

    IF NOT freebie AND cost_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- get this user's median item score
    SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP(ORDER BY "weightedVotes" - "weightedDownVotes"), 0)
        INTO med_votes FROM "Item" WHERE "userId" = user_id;

    -- if their median votes are positive, start at 0
    -- if the median votes are negative, start their post with that many down votes
    -- basically: if their median post is bad, presume this post is too
    -- addendum: if they're an anon poster, always start at 0
    IF med_votes >= 0 OR user_id = 27 THEN
        med_votes := 0;
    ELSE
        med_votes := ABS(med_votes);
    END IF;

    INSERT INTO "Item"
    ("subName", title, url, text, bounty, "userId", "parentId",
        freebie, "weightedDownVotes", created_at, updated_at)
    VALUES
    (sub, title, url, text, bounty, user_id, parent_id,
        freebie, med_votes, now_utc(), now_utc()) RETURNING * INTO item;

    INSERT INTO "ItemForward" ("itemId", "userId", "pct")
        SELECT item.id, "userId", "pct" from json_populate_recordset(null::ItemForwardType, forward);

    IF NOT freebie THEN
        UPDATE users SET msats = msats - cost_msats WHERE id = user_id;

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
        VALUES (cost_msats, item.id, user_id, 'FEE', now_utc(), now_utc());
    END IF;

    IF boost > 0 THEN
        PERFORM item_act(item.id, user_id, 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;

DROP FUNCTION IF EXISTS update_item(
    sub TEXT, item_id INTEGER, item_title TEXT, item_url TEXT, item_text TEXT, boost INTEGER,
    item_bounty INTEGER, fwd_user_id INTEGER);

CREATE OR REPLACE FUNCTION update_item(
    sub TEXT, item_id INTEGER, item_title TEXT, item_url TEXT, item_text TEXT, boost INTEGER,
    item_bounty INTEGER, forward JSON)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats INTEGER;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    UPDATE "Item"
    SET "subName" = sub, title = item_title, url = item_url,
        text = item_text, bounty = item_bounty
    WHERE id = item_id
    RETURNING * INTO item;

    -- Delete all old forward entries, to recreate in next command
    DELETE FROM "ItemForward"
    WHERE "itemId" = item_id;

    INSERT INTO "ItemForward" ("itemId", "userId", "pct")
        SELECT item_id, "userId", "pct" from json_populate_recordset(null::ItemForwardType, forward);

    IF boost > 0 THEN
        PERFORM item_act(item.id, item."userId", 'BOOST', boost);
    END IF;

    RETURN item;
END;
$$;