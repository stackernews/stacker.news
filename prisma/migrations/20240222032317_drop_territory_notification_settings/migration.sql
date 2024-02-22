/*
  Warnings:

  - You are about to drop the column `noteTerritoryPosts` on the `users` table. All the data in the column will be lost.

*/

-- migrate values from founders which had notifications for territory posts enabled to new table
INSERT INTO "SubSubscription"("userId", "subName")
SELECT u.id, s.name
FROM users u JOIN "Sub" s ON u.id = s."userId"
WHERE "noteTerritoryPosts";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "noteTerritoryPosts";
