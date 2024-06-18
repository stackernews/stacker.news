import { notifyNewStreak, notifyStreakLost } from '@/lib/webPush'

const STREAK_THRESHOLD = 100

export async function computeStreaks ({ models }) {
  // get all eligible users in the last day
  // if the user doesn't have an active streak, add one
  // if they have an active streak but didn't maintain it, end it
  const endingStreaks = await models.$queryRaw`
    WITH day_streaks (id) AS (
      SELECT "userId"
      FROM
      ((SELECT "userId", floor(sum("ItemAct".msats)/1000) as sats_spent
          FROM "ItemAct"
          WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date
          AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
          GROUP BY "userId")
      UNION ALL
      (SELECT "userId", sats as sats_spent
          FROM "Donation"
          WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date
      )
      UNION ALL
      (SELECT "userId", floor(sum("SubAct".msats)/1000) as sats_spent
        FROM "SubAct"
        WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date
        AND "type" = 'BILLING'
        GROUP BY "userId")) spending
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
    WHERE ending_streaks.id = "Streak"."userId" AND "endedAt" IS NULL
    RETURNING "Streak".id, ending_streaks."id" AS "userId"`

  Promise.allSettled(endingStreaks.map(streak => notifyStreakLost(streak.userId, streak)))
}

export async function checkStreak ({ data: { id }, models }) {
  // if user is actively streaking skip
  let streak = await models.streak.findFirst({
    where: {
      userId: Number(id),
      endedAt: null
    }
  })

  if (streak) {
    return
  }

  [streak] = await models.$queryRaw`
    WITH streak_started (id) AS (
        SELECT "userId"
        FROM
        ((SELECT "userId", floor(sum("ItemAct".msats)/1000) as sats_spent
            FROM "ItemAct"
            WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago')::date
            AND "userId" = ${Number(id)}
            AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
            GROUP BY "userId")
        UNION ALL
        (SELECT "userId", sats as sats_spent
            FROM "Donation"
            WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago')::date
            AND "userId" = ${Number(id)}
        )
        UNION ALL
        (SELECT "userId", floor(sum("SubAct".msats)/1000) as sats_spent
          FROM "SubAct"
          WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= (now() AT TIME ZONE 'America/Chicago')::date
          AND "userId" = ${Number(id)}
          AND "type" = 'BILLING'
          GROUP BY "userId")
        ) spending
          GROUP BY "userId"
          HAVING sum(sats_spent) >= ${STREAK_THRESHOLD}
    ), user_start_streak AS (
      UPDATE users SET streak = 0 FROM streak_started WHERE streak_started.id = users.id
    )
    INSERT INTO "Streak" ("userId", "startedAt", created_at, updated_at)
    SELECT id, (now() AT TIME ZONE 'America/Chicago')::date, now_utc(), now_utc()
    FROM streak_started
    RETURNING "Streak".id`

  if (!streak) return

  // new streak started for user
  notifyNewStreak(id, streak)
}
