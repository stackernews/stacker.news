-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "subNames" TEXT[];

-- CreateTable
CREATE TABLE "ItemSub" (
    "subName" CITEXT NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "ItemSub_pkey" PRIMARY KEY ("subName","itemId")
);

-- CreateIndex
CREATE INDEX "ItemSub_itemId_idx" ON "ItemSub"("itemId");

-- CreateIndex
CREATE INDEX "ItemSub_subName_idx" ON "ItemSub"("subName");

-- AddForeignKey
ALTER TABLE "ItemSub" ADD CONSTRAINT "ItemSub_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSub" ADD CONSTRAINT "ItemSub_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- create new update_subnames trigger
CREATE OR REPLACE FUNCTION public.update_subnames()
    RETURNS TRIGGER
    AS $$
BEGIN
    UPDATE "Item"
    SET "subNames" = (
        SELECT ARRAY_AGG("subName")
        FROM "ItemSub"
        WHERE "itemId" = NEW."id"
    )
    WHERE "id" = NEW."id";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subnames_trigger
AFTER INSERT OR UPDATE ON "ItemSub"
FOR EACH ROW
EXECUTE FUNCTION update_subnames();

-- update create_item function
CREATE OR REPLACE FUNCTION public.create_item(
	sub text,
	title text,
	url text,
	text text,
	boost integer,
	bounty integer,
	parent_id integer,
	user_id integer,
	fwd_user_id integer,
	spam_within interval,
	subs text[])
    RETURNS "Item"
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
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
    ("subName", title, url, text, bounty, "userId", "parentId", "fwdUserId",
        freebie, "weightedDownVotes", created_at, updated_at)
    VALUES
    (sub, title, url, text, bounty, user_id, parent_id, fwd_user_id,
        freebie, med_votes, now_utc(), now_utc()) RETURNING * INTO item; 

    IF NOT freebie THEN
        UPDATE users SET msats = msats - cost_msats WHERE id = user_id;

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
        VALUES (cost_msats, item.id, user_id, 'FEE', now_utc(), now_utc());
    END IF;

    IF boost > 0 THEN
        PERFORM item_act(item.id, user_id, 'BOOST', boost);
    END IF;

    -- Loop over the 'subs' array and insert into "ItemSub"
    FOREACH sub_name IN ARRAY subs
    LOOP
        INSERT INTO "ItemSub" ("itemId", "subName")
        VALUES (item.id, sub_name);
    END LOOP;

    RETURN item;
END;
$BODY$;

ALTER FUNCTION public.create_item(text, text, text, text, integer, integer, integer, integer, integer, interval, text[])
    OWNER TO postgres;


-- update update_item function
CREATE OR REPLACE FUNCTION public.update_item(
	sub text,
	item_id integer,
	item_title text,
	item_url text,
	item_text text,
	boost integer,
	item_bounty integer,
	fwd_user_id integer,
	subs text[])
    RETURNS "Item"
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE
    user_msats INTEGER;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    UPDATE "Item"
    SET "subName" = sub, title = item_title, url = item_url,
        text = item_text, bounty = item_bounty, "fwdUserId" = fwd_user_id
    WHERE id = item_id
    RETURNING * INTO item;

    IF boost > 0 THEN
        PERFORM item_act(item.id, item."userId", 'BOOST', boost);
    END IF;

    -- Loop over the 'subs' array and insert into "ItemSub" if it does not already exist
    FOREACH sub_name IN ARRAY subs
    LOOP
        INSERT INTO "ItemSub" ("itemId", "subName")
        SELECT item.id, sub_name
        WHERE NOT EXISTS (
            SELECT 1 FROM "ItemSub"
            WHERE "itemId" = item.id AND "subName" = sub_name
        );
    END LOOP;

    RETURN item;
END;
$BODY$;

ALTER FUNCTION public.update_item(text, integer, text, text, text, integer, integer, integer, text[])
    OWNER TO postgres;

-- Update new database fields and tables with existing data
-- Insert into ItemSub table
INSERT INTO "ItemSub" ("itemId", "subName")
SELECT "id", "subName"
FROM "Item"
WHERE "subName" IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM "ItemSub" WHERE "itemId" = "Item"."id" AND "subName" = "Item"."subName"
);

-- Update subs array in Item table
UPDATE "Item" AS A
SET "subNames" = B."subNames"
FROM (
    SELECT "itemId", ARRAY_AGG("subName") AS "subNames"
    FROM "ItemSub"
    GROUP BY "itemId"
) AS B
WHERE A."id" = B."itemId";
