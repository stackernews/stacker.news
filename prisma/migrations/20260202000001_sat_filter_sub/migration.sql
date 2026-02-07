-- Sat Filter Refactoring: Sub (Territory) Model Changes
-- Adds postsSatsFilter to Sub
-- Removes moderated and moderatedCount

-- Add filter column to Sub
ALTER TABLE "Sub" ADD COLUMN "postsSatsFilter" INT NOT NULL DEFAULT 10;

-- Backfill postsSatsFilter = baseCost for existing territories
UPDATE "Sub" SET "postsSatsFilter" = "baseCost";

-- Drop moderation columns from Sub
ALTER TABLE "Sub" DROP COLUMN "moderated";
ALTER TABLE "Sub" DROP COLUMN "moderatedCount";
