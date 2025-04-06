-- we had a bug where it was possible to delete bios, this migration will restore them
UPDATE "Item"
SET "deletedAt" = NULL
WHERE "bio"
