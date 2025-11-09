import { notifyNewStreak, notifyStreakLost } from '@/lib/webPush'
import { Prisma } from '@prisma/client'

const COWBOY_HAT_STREAK_THRESHOLD = 100

export async function computeStreaks ({ models }) {
  // get all eligible users in the last day
  // if the user doesn't have an active streak, add one
  // if they have an active streak but didn't maintain it, end it
  const type = 'COWBOY_HAT'
  const endingStreaks = await models.$queryRaw`
    WITH day_streaks (id) AS (
      ${getStreakQuery(type)}
    ), existing_streaks (id, started_at) AS (
      SELECT "userId", "startedAt"
      FROM "Streak"
      WHERE "Streak"."endedAt" IS NULL
      AND "type" = ${type}::"StreakType"
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
      INSERT INTO "Streak" ("userId", "startedAt", "type", created_at, updated_at)
      SELECT id, (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date, ${type}::"StreakType", now_utc(), now_utc()
      FROM new_streaks
    ), user_update_new_streaks AS (
      UPDATE users SET "streak" = 1 FROM new_streaks WHERE new_streaks.id = users.id
    ), user_update_end_streaks AS (
      UPDATE users SET "streak" = NULL FROM ending_streaks WHERE ending_streaks.id = users.id
    ), user_update_extend_streaks AS (
      UPDATE users
      SET "streak" = (now() AT TIME ZONE 'America/Chicago')::date - extending_streaks.started_at::date
      FROM extending_streaks WHERE extending_streaks.id = users.id
    )
    UPDATE "Streak"
    SET "endedAt" = (now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date, updated_at = now_utc()
    FROM ending_streaks
    WHERE ending_streaks.id = "Streak"."userId" AND "endedAt" IS NULL AND "type" = ${type}::"StreakType"
    RETURNING "Streak".*`

  Promise.allSettled(endingStreaks.map(streak => notifyStreakLost(streak.userId, streak)))
}

export async function checkStreak ({ data: { id, type = 'COWBOY_HAT' }, models }) {
  // if user is actively streaking skip
  const user = await models.user.findUnique({
    where: {
      id: Number(id)
    }
  })

  console.log('checking streak', id, type, isStreakActive(type, user))

  if (isStreakActive(type, user)) {
    return
  }

  const [streak] = await models.$queryRaw`
    WITH streak_started (id) AS (
        ${getStreakQuery(type, id)}
    ), user_start_streak AS (
      UPDATE users SET "streak" = 0 FROM streak_started WHERE streak_started.id = users.id
    )
    INSERT INTO "Streak" ("userId", "startedAt", "type", created_at, updated_at)
    SELECT id, (now() AT TIME ZONE 'America/Chicago')::date, ${type}::"StreakType", now_utc(), now_utc()
    FROM streak_started
    RETURNING "Streak".*`

  if (!streak) return

  // new streak started for user
  notifyNewStreak(id, streak)
}

function getStreakQuery (type, userId) {
  const dayFragment = userId
    ? Prisma.sql`(now() AT TIME ZONE 'America/Chicago')::date`
    : Prisma.sql`(now() AT TIME ZONE 'America/Chicago' - interval '1 day')::date`

  return Prisma.sql`
      SELECT "PayIn"."userId"
        FROM "PayIn"
        WHERE "PayIn"."payInState" = 'PAID'
        AND ("PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date >= ${dayFragment}
        ${userId ? Prisma.sql`AND "PayIn"."userId" = ${userId}` : Prisma.empty}
        GROUP BY "PayIn"."userId"
        HAVING sum("PayIn"."mcost") / 1000.0 >= ${COWBOY_HAT_STREAK_THRESHOLD}`
}

function isStreakActive (type, user) {
  return typeof user.streak === 'number'
}
