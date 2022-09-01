-- AlterTable
ALTER TABLE "Item"
ADD COLUMN IF NOT EXISTS    "commentSats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS    "lastCommentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS    "ncomments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS    "sats" INTEGER NOT NULL DEFAULT 0;

-- denormalize all existing comments
-- for every item, compute the lastest comment time and number of comments
UPDATE "Item"
SET "lastCommentAt" = subquery."lastCommentAt", ncomments = subquery.ncomments
FROM (
    SELECT a.id, MAX(b.created_at) AS "lastCommentAt", COUNT(b.id) AS ncomments
    FROM "Item" a
    LEFT JOIN "Item" b ON b.path <@ a.path AND a.id <> b.id
    GROUP BY a.id) subquery
WHERE "Item".id = subquery.id;

-- on comment denormalize comment count and time
CREATE OR REPLACE FUNCTION ncomments_after_comment() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    UPDATE "Item"
    SET "lastCommentAt" = now_utc(), "ncomments" = "ncomments" + 1
    WHERE id <> NEW.id and path @> NEW.path;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ncomments_after_comment_trigger ON "Item";
CREATE TRIGGER ncomments_after_comment_trigger
    AFTER INSERT ON "Item"
    FOR EACH ROW
    EXECUTE PROCEDURE ncomments_after_comment();

-- denormalize all existing sats
-- for every item, compute the total sats it has earned
UPDATE "Item"
SET sats = subquery.sats
FROM (
    SELECT a.id, SUM(c.sats) AS sats
    FROM "Item" a
    JOIN "ItemAct" c ON c."itemId" = a.id AND c."userId" <> a."userId"
    WHERE c.act IN ('VOTE', 'TIP')
    GROUP BY a.id) subquery
WHERE "Item".id = subquery.id;

-- denormalize comment sats
UPDATE "Item"
SET "commentSats" = subquery."commentSats"
FROM (
    SELECT a.id, SUM(b.sats) AS "commentSats"
    FROM "Item" a
    JOIN "Item" b ON b.path <@ a.path AND a.id <> b.id
    GROUP BY a.id) subquery
WHERE "Item".id = subquery.id;

-- on item act denormalize sats and comment sats
CREATE OR REPLACE FUNCTION sats_after_act() RETURNS TRIGGER AS $$
DECLARE
    item "Item";
BEGIN
    SELECT * FROM "Item" WHERE id = NEW."itemId" INTO item;
    IF item."userId" = NEW."userId" THEN
        RETURN NEW;
    END IF;

    UPDATE "Item"
    SET "sats" = "sats" + NEW.sats
    WHERE id = item.id;

    UPDATE "Item"
    SET "commentSats" = "commentSats" + NEW.sats
    WHERE id <> item.id and path @> item.path;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sats_after_act_trigger ON "ItemAct";
CREATE TRIGGER sats_after_act_trigger
    AFTER INSERT ON "ItemAct"
    FOR EACH ROW
    WHEN (NEW.act = 'VOTE' or NEW.act = 'TIP')
    EXECUTE PROCEDURE sats_after_act();