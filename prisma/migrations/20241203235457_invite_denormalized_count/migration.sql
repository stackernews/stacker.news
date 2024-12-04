-- AlterTable
ALTER TABLE "Invite" ADD COLUMN "giftedCount" INTEGER NOT NULL DEFAULT 0;

-- denormalize giftedCount
UPDATE "Invite"
SET "giftedCount" = (SELECT COUNT(*) FROM "users" WHERE "users"."inviteId" = "Invite".id)
WHERE "Invite"."id" = "Invite".id;
