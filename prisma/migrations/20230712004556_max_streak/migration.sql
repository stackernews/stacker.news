-- AlterTable
ALTER TABLE "users" ADD COLUMN     "maxStreak" INTEGER;

WITH users_max_streak AS (
    SELECT "userId", MAX("endedAt" - "startedAt") AS "maxStreak"
    FROM "Streak"
    GROUP BY "userId"
)
UPDATE users
SET "maxStreak" = users_max_streak."maxStreak"
FROM users_max_streak
WHERE users.id = users_max_streak."userId";
