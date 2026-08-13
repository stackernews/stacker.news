-- Denormalize the owner of the referenced item so item mention notifications
-- can be fetched directly by recipient and creation time.
ALTER TABLE "ItemMention" ADD COLUMN "refereeUserId" INTEGER;

UPDATE "ItemMention"
SET "refereeUserId" = "Referee"."userId"
FROM "Item" "Referee"
WHERE "ItemMention"."refereeId" = "Referee".id;

ALTER TABLE "ItemMention" ALTER COLUMN "refereeUserId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ItemMention_refereeUserId_created_at_idx"
ON "ItemMention"("refereeUserId", created_at);

CREATE INDEX IF NOT EXISTS "Item_userId_lastZapAt_idx"
ON "Item"("userId", "lastZapAt");
