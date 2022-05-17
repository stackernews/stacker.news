-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "boost" INTEGER NOT NULL DEFAULT 0;

-- loop over all existing votes and denormalize them
UPDATE "Item"
SET boost = subquery.boost
FROM (SELECT "ItemAct"."itemId", SUM("ItemAct".sats) AS boost
        FROM "ItemAct"
        WHERE "ItemAct".act = 'BOOST'
        GROUP BY "ItemAct"."itemId") subquery
WHERE "Item".id = subquery."itemId";

CREATE OR REPLACE FUNCTION boost_after_act() RETURNS TRIGGER AS $$
BEGIN
    -- update item
    UPDATE "Item" SET boost = boost + NEW.sats WHERE id = NEW."itemId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS boost_after_act ON "ItemAct";
CREATE TRIGGER boost_after_act
    AFTER INSERT ON "ItemAct"
    FOR EACH ROW
    WHEN (NEW.act = 'BOOST')
    EXECUTE PROCEDURE boost_after_act();