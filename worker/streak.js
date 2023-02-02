const STREAK_THRESHOLD = 100

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
        HAVING sum(sats_spent) >= ${STREAK_THRESHOLD}
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

function checkStreak ({ models }) {
  return async function ({ data: { id } }) {
    console.log('checking streak', id)

    // if user is actively streaking skip
    const streak = await models.streak.findFirst({
      where: {
        userId: Number(id),
        endedAt: null
      }
    })

    if (streak) {
      console.log('done checking streak', id)
      return
    }

    await models.$executeRaw`
      WITH streak_started (id) AS (
          SELECT "userId"
          FROM
          ((SELECT "userId", floor(sum("ItemAct".msats)/1000) as sats_spent
              FROM "ItemAct"
              WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date = (now() AT TIME ZONE 'America/Chicago')::date
              AND "userId" = ${Number(id)}
              GROUP BY "userId")
          UNION ALL
          (SELECT "userId", sats as sats_spent
              FROM "Donation"
              WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date = (now() AT TIME ZONE 'America/Chicago')::date
              AND "userId" = ${Number(id)}
          )) spending
            GROUP BY "userId"
            HAVING sum(sats_spent) >= ${STREAK_THRESHOLD}
      )
      INSERT INTO "Streak" ("userId", "startedAt", created_at, updated_at)
      SELECT id, (now() AT TIME ZONE 'America/Chicago')::date, now_utc(), now_utc()
      FROM streak_started`

    console.log('done checking streak', id)
  }
}

module.exports = { checkStreak, computeStreaks }
