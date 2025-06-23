-- refund the founder revenue difference
WITH "SubActRevenue" AS (
    SELECT "SubAct"."subName", "SubAct"."userId", FLOOR(SUM("SubAct"."msats") * 2 * 0.2) AS "msats"
    FROM "SubAct" JOIN "Sub" ON "SubAct"."subName" = "Sub"."name" AND "Sub"."rewardsPct" = 50
    WHERE "SubAct"."type" = 'REVENUE' AND "SubAct".created_at > '2024-09-19T21:38:43.918Z'
    GROUP BY "SubAct"."subName", "SubAct"."userId"
), "FounderRevenue" AS (
    SELECT "userId", SUM("msats") AS "msats"
    FROM "SubActRevenue"
    GROUP BY "userId"
), insert_acts AS (
    INSERT INTO "SubAct" ("subName", "userId", "msats", "type")
    SELECT "SubActRevenue"."subName", "SubActRevenue"."userId", "SubActRevenue"."msats", 'REVENUE'
    FROM "SubActRevenue"
)
UPDATE users SET msats = users.msats + "FounderRevenue"."msats", "stackedMsats" = users."stackedMsats" + "FounderRevenue"."msats"
FROM "FounderRevenue"
WHERE "FounderRevenue"."userId" = "users"."id";

-- set the default territory cut to 30%
ALTER TABLE "Sub" ALTER COLUMN "rewardsPct" SET DEFAULT 30;

-- update all subs to 30%
UPDATE "Sub" SET "rewardsPct" = 30 WHERE "rewardsPct" = 50;