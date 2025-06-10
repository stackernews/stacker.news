-- Alter table to add fields for delayed Nostr crosspost
ALTER TABLE "Item"
ADD COLUMN "pendingNostrCrosspost" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN "nostrCrosspostAt" TIMESTAMP;
