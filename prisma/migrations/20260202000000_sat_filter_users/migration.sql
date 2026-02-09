-- Sat Filter Refactoring: User Model Changes
-- Adds postsSatsFilter and commentsSatsFilter (replacing satsFilter)
-- Adds freeCommentCount and freeCommentResetAt for monthly limits
-- Removes wildWestMode

-- Add new filter columns to users
ALTER TABLE "users" ADD COLUMN "postsSatsFilter" INT NOT NULL DEFAULT 10;
ALTER TABLE "users" ADD COLUMN "commentsSatsFilter" INT NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "freeCommentCount" INT NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "freeCommentResetAt" TIMESTAMP(3);

-- Migrate existing satsFilter to postsSatsFilter
UPDATE "users" SET "postsSatsFilter" = "satsFilter" WHERE "satsFilter" IS NOT NULL;

-- Drop old columns from users
ALTER TABLE "users" DROP COLUMN "satsFilter";
ALTER TABLE "users" DROP COLUMN "wildWestMode";
