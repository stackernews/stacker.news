function computeStreaks ({ models }) {
  return async function () {
    console.log('computing streaks')

    // get all eligible users in the last day
    // if the user doesn't have an active streak, add one
    // if they have an active streak but didn't maintain it, end it
    await models.$executeRaw(
      `WITH day_streaks (id) AS (
        SELECT "userId"
        FROM
        ((SELECT "userId", floor(sum("ItemAct".msats)/1000) as sats_spent
            FROM "ItemAct"
            WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date = (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date
            GROUP BY "userId")
        UNION ALL
        (SELECT "userId", sats as sats_spent
            FROM "Donation"
            WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date = (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date
        )) spending
        GROUP BY "userId"
        HAVING sum(sats_spent) >= 100
      ), existing_streaks (id) AS (
          SELECT "userId"
          FROM "Streak"
          WHERE "Streak"."endedAt" IS NULL
      ), new_streaks (id) AS (
          SELECT day_streaks.id
          FROM day_streaks
          LEFT JOIN existing_streaks ON existing_streaks.id = day_streaks.id
          WHERE existing_streaks.id IS NULL
      ), ending_streaks (id) AS (
          SELECT existing_streaks.id
          FROM existing_streaks
          LEFT JOIN day_streaks ON existing_streaks.id = day_streaks.id
          WHERE day_streaks.id IS NULL
      ), streak_insert AS (
          INSERT INTO "Streak" ("userId", "startedAt", created_at, updated_at)
          SELECT id, (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date, now_utc(), now_utc()
          FROM new_streaks
      )
      UPDATE "Streak"
      SET "endedAt" = (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date, updated_at = now_utc()
      FROM ending_streaks
      WHERE ending_streaks.id = "Streak"."userId"`)

    console.log('done computing streaks')
  }
}

module.exports = { computeStreaks }
