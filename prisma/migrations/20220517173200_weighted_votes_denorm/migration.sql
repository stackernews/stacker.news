-- AlterTable
ALTER TABLE "Item" ADD COLUMN "weightedVotes" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- loop over all existing votes and denormalize them
UPDATE "Item"
SET "weightedVotes" = subquery.votes
FROM (SELECT "ItemAct"."itemId", SUM(users.trust) AS votes
        FROM "ItemAct"
        JOIN users ON "ItemAct"."userId" = users.id
        JOIN "Item" ON "Item".id = "ItemAct"."itemId"
        WHERE "ItemAct".act = 'VOTE' AND "Item"."userId" <> "ItemAct"."userId"
        GROUP BY "ItemAct"."itemId") subquery
WHERE "Item".id = subquery."itemId";

CREATE OR REPLACE FUNCTION weighted_votes_after_act() RETURNS TRIGGER AS $$
DECLARE
    user_trust DOUBLE PRECISION;
BEGIN
    -- grab user's trust who is upvoting
    SELECT trust INTO user_trust FROM users WHERE id = NEW."userId";
    -- update item
    UPDATE "Item"
        SET "weightedVotes" = "weightedVotes" + user_trust
        WHERE id = NEW."itemId" AND "userId" <> NEW."userId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS weighted_votes_after_act ON "ItemAct";
CREATE TRIGGER weighted_votes_after_act
    AFTER INSERT ON "ItemAct"
    FOR EACH ROW
    WHEN (NEW.act = 'VOTE')
    EXECUTE PROCEDURE weighted_votes_after_act();