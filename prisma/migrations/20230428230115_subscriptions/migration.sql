-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subs" TEXT[];

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subName" CITEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Subscription" ADD FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- create the nostr sub ignoring conflicts
INSERT INTO "Sub" ("name", "desc", "postTypes", "rankingType")
VALUES ('nostr', 'everything nostr related', '{LINK,DISCUSSION,POLL,BOUNTY}', 'WOT') ON CONFLICT DO NOTHING;

-- create bitcoin sub ignoring conflicts
INSERT INTO "Sub" ("name", "desc", "postTypes", "rankingType")
VALUES ('bitcoin', 'everything bitcoin related', '{LINK,DISCUSSION,POLL,BOUNTY}', 'WOT') ON CONFLICT DO NOTHING;

-- all root items with null subName put in bitcoin sub ... unless title has nostr in it
UPDATE "Item"
SET "subName" = 'bitcoin'
WHERE "Item"."subName" IS NULL
AND "Item"."parentId" IS NULL
AND "Item".title NOT ILIKE '%nostr%';

UPDATE "Item"
SET "subName" = 'nostr'
WHERE "Item"."subName" IS NULL
AND "Item"."parentId" IS NULL
AND "Item".title ILIKE '%nostr%';
