-- AlterTable
ALTER TABLE "Item" ADD COLUMN "upvotes" INTEGER NOT NULL DEFAULT 0;

UPDATE "Item"
SET upvotes = subquery.votes
FROM (SELECT "ItemAct"."itemId", COUNT(DISTINCT "userId") AS votes
        FROM "ItemAct"
        WHERE "ItemAct".act = 'TIP'
        GROUP BY "ItemAct"."itemId") subquery
WHERE "Item".id = subquery."itemId";

CREATE OR REPLACE FUNCTION weighted_votes_after_tip(item_id INTEGER, user_id INTEGER, sats INTEGER) RETURNS INTEGER AS $$
DECLARE
    user_trust DOUBLE PRECISION;
    sats_past INTEGER;
    vote_add INTEGER := 0;
    multiplier DOUBLE PRECISION;
BEGIN
    -- grab user's trust who is upvoting
    SELECT trust INTO user_trust FROM users WHERE id = user_id;

    -- in order to add this to weightedVotes, we need to do log((satsN+satsPrior)/satsPrior)
    -- so compute sats prior
    SELECT SUM(msats) / 1000 INTO sats_past
    FROM "ItemAct"
    WHERE "userId" = user_id AND "itemId" = item_id AND act IN ('TIP', 'FEE');

    IF sats_past IS NULL OR sats_past = 0 THEN
        multiplier := LOG(sats);
        vote_add := 1;
    ELSE
        multiplier := LOG((sats+sats_past)/sats_past::FLOAT);
    END IF;

    -- update item
    UPDATE "Item"
        SET "weightedVotes" = "weightedVotes" + (user_trust * multiplier), upvotes = upvotes + vote_add
        WHERE id = item_id AND "userId" <> user_id;

    RETURN 0;
END;
$$ LANGUAGE plpgsql;