const STREAK_THRESHOLD = 100

function computeStreaks ({ models }) {
  return async function () {
    console.log('computing streaks')

    // get all eligible users in the last day
    // if the user doesn't have an active streak, add one
    // if they have an active streak but didn't maintain it, end it
    await models.$executeRawUnsafe(
      `WITH day_streaks (id) AS (
        SELECT "userId"
        FROM
        ((SELECT "userId", floor(sum("ItemAct".msats)/1000) as sats_spent
            FROM "ItemAct"
            WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date
            GROUP BY "userId")
        UNION ALL
        (SELECT "userId", sats as sats_spent
            FROM "Donation"
            WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date
        )) spending
        GROUP BY "userId"
        HAVING sum(sats_spent) >= 100
      ), existing_streaks (id, started_at) AS (
        SELECT "userId", "startedAt"
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
      ), extending_streaks (id, started_at) AS (
        SELECT existing_streaks.id, existing_streaks.started_at
        FROM existing_streaks
        JOIN day_streaks ON existing_streaks.id = day_streaks.id
      ),
      -- a bunch of mutations
      streak_insert AS (
        INSERT INTO "Streak" ("userId", "startedAt", created_at, updated_at)
        SELECT id, (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date, now_utc(), now_utc()
        FROM new_streaks
      ), user_update_new_streaks AS (
        UPDATE users SET streak = 1 FROM new_streaks WHERE new_streaks.id = users.id
      ), user_update_end_streaks AS (
        UPDATE users SET streak = NULL FROM ending_streaks WHERE ending_streaks.id = users.id
      ), user_update_extend_streaks AS (
        UPDATE users
        SET streak = (now() AT TIME ZONE 'America/Chicago')::date - extending_streaks.started_at
        FROM extending_streaks WHERE extending_streaks.id = users.id
      )
      UPDATE "Streak"
      SET "endedAt" = (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date, updated_at = now_utc()
      FROM ending_streaks
      WHERE ending_streaks.id = "Streak"."userId" AND "endedAt" IS NULL`)

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
              WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago')::date
              AND "userId" = ${Number(id)}
              GROUP BY "userId")
          UNION ALL
          (SELECT "userId", sats as sats_spent
              FROM "Donation"
              WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago')::date
              AND "userId" = ${Number(id)}
          )) spending
            GROUP BY "userId"
            HAVING sum(sats_spent) >= ${STREAK_THRESHOLD}
      ), user_start_streak AS (
        UPDATE users SET streak = 0 FROM streak_started WHERE streak_started.id = users.id
      )
      INSERT INTO "Streak" ("userId", "startedAt", created_at, updated_at)
      SELECT id, (now() AT TIME ZONE 'America/Chicago')::date, now_utc(), now_utc()
      FROM streak_started`

    console.log('done checking streak', id)
  }
}

module.exports = { checkStreak, computeStreaks }
