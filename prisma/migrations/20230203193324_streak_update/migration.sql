UPDATE users set streak = (now() AT TIME ZONE 'America/Chicago')::date - "Streak"."startedAt"
FROM "Streak"
WHERE "endedAt" IS NULL AND users.id = "Streak"."userId";