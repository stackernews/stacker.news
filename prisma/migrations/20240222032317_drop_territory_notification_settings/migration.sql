-- migrate values from founders which had notifications for territory posts enabled to new table
INSERT INTO "SubSubscription"("userId", "subName")
SELECT u.id, s.name
FROM users u JOIN "Sub" s ON u.id = s."userId"
WHERE "noteTerritoryPosts";

-- we don't drop the users.noteTerritoryPosts column in this migration since it's a backwards incompatible change
