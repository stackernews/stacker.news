-- fix missing 'bio' marker for bios
UPDATE "Item" SET bio = 't' WHERE id IN (
    SELECT "bioId" FROM users WHERE "bioId" IS NOT NULL
);
