-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "lastZapAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Item_lastZapAt_idx" ON "Item"("lastZapAt");

-- CreateIndex
CREATE INDEX "Reply_itemId_idx" ON "Reply"("itemId");

-- CreateIndex
CREATE INDEX "Reply_userId_idx" ON "Reply"("userId");


-- when an item is zapped, update the lastZapAt field
CREATE OR REPLACE FUNCTION sats_after_tip(item_id INTEGER, user_id INTEGER, tip_msats BIGINT) RETURNS INTEGER AS $$
DECLARE
    item "Item";
BEGIN
    SELECT * FROM "Item" WHERE id = item_id INTO item;
    IF user_id <> 27 AND item."userId" = user_id THEN
        RETURN 0;
    END IF;

    UPDATE "Item"
    SET "msats" = "msats" + tip_msats,
        "lastZapAt" = now()
    WHERE id = item.id;

    UPDATE "Item"
    SET "commentMsats" = "commentMsats" + tip_msats
    WHERE id <> item.id and path @> item.path;

    RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- retrofit the lastZapAt field for all existing items
UPDATE "Item" SET "lastZapAt" = "Zap".at
FROM (
    SELECT "ItemAct"."itemId", MAX("ItemAct"."created_at") AS at
    FROM "ItemAct"
    WHERE "ItemAct".act = 'TIP'
    GROUP BY "ItemAct"."itemId"
) AS "Zap"
WHERE "Item"."id" = "Zap"."itemId";