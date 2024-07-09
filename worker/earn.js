import { notifyEarner } from '@/lib/webPush.js'
import { PrismaClient } from '@prisma/client'
import { proportions } from '@/lib/madness.js'
import { SN_NO_REWARDS_IDS } from '@/lib/constants.js'

const TOTAL_UPPER_BOUND_MSATS = 1_000_000_000

export async function earn ({ name }) {
  // grab a greedy connection
  const models = new PrismaClient()

  try {
    // compute how much sn earned yesterday
    const [{ sum: sumDecimal }] = await models.$queryRaw`
      SELECT sum(total) as sum
      FROM rewards(
        date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'),
        date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'), '1 day'::INTERVAL, 'day')`

    // XXX primsa will return a Decimal (https://mikemcl.github.io/decimal.js)
    // because sum of a BIGINT returns a NUMERIC type (https://www.postgresql.org/docs/13/functions-aggregate.html)
    // and Decimal is what prisma maps it to
    // https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#raw-query-type-mapping
    // so check it before coercing to Number
    if (!sumDecimal || sumDecimal.lessThanOrEqualTo(0)) {
      console.log('done', name, 'no sats to award today')
      return
    }

    // extra sanity check on rewards ... if it's more than upper bound, we
    // probably have a bug somewhere or we've grown A LOT
    if (sumDecimal.greaterThan(TOTAL_UPPER_BOUND_MSATS)) {
      console.log('done', name, 'error: too many sats to award today', sumDecimal)
      return
    }

    const sum = Number(sumDecimal)

    console.log(name, 'giving away', sum, 'msats', 'rewarding all')

    /*
      How earnings (used to) work:
      1/3: top 21% posts over last 36 hours, scored on a relative basis
      1/3: top 21% comments over last 36 hours, scored on a relative basis
      1/3: top upvoters of top posts/comments, scored on:
        - their trust
        - how much they tipped
        - how early they upvoted it
        - how the post/comment scored

      Now: 100% of earnings go to top 33% of comments/posts and their upvoters for month
    */

    // get earners { userId, id, type, rank, proportion, foreverReferrerId, oneDayReferrerId }
    const earners = await models.$queryRaw`
      WITH earners AS (
        SELECT users.id AS "userId", users."referrerId" AS "foreverReferrerId",
          proportion, ROW_NUMBER() OVER (ORDER BY proportion DESC) AS rank
        FROM user_values(
          date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'),
          date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'),
          '1 day'::INTERVAL,
          'day') uv
        JOIN users ON users.id = uv.id
        WHERE NOT (users.id = ANY (${SN_NO_REWARDS_IDS}))
        ORDER BY proportion DESC
        LIMIT 100
      )
      SELECT earners.*,
        COALESCE(
          mode() WITHIN GROUP (ORDER BY "OneDayReferral"."referrerId"),
          earners."foreverReferrerId") AS "oneDayReferrerId"
      FROM earners
      LEFT JOIN "OneDayReferral" ON "OneDayReferral"."refereeId" = earners."userId"
      WHERE "OneDayReferral".created_at >= date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day')
      GROUP BY earners."userId", earners."foreverReferrerId", earners.proportion, earners.rank
      ORDER BY rank ASC`

    // in order to group earnings for users we use the same createdAt time for
    // all earnings
    const now = new Date(new Date().getTime())

    // this is just a sanity check because it seems like a good idea
    let total = 0

    const notifications = {}
    for (const [i, earner] of earners.entries()) {
      const foreverReferrerEarnings = Math.floor(parseFloat(earner.proportion * sum * 0.1)) // 10% of earnings
      const oneDayReferrerEarnings = Math.floor(parseFloat(earner.proportion * sum * 0.1)) // 10% of earnings
      const earnerEarnings = Math.floor(parseFloat(proportions[i] * sum)) - foreverReferrerEarnings - oneDayReferrerEarnings

      total += earnerEarnings + foreverReferrerEarnings + oneDayReferrerEarnings
      if (total > sum) {
        console.log(name, 'total exceeds sum', total, '>', sum)
        return
      }

      console.log(
        'stacker', earner.userId,
        'earned', earnerEarnings,
        'proportion', earner.proportion,
        'rank', earner.rank,
        'type', earner.type,
        'foreverReferrer', earner.foreverReferrerId,
        'foreverReferrerEarnings', foreverReferrerEarnings,
        'oneDayReferrer', earner.oneDayReferrerId,
        'oneDayReferrerEarnings', oneDayReferrerEarnings)

      if (earnerEarnings > 0) {
        await models.$executeRaw`SELECT earn(${earner.userId}::INTEGER, ${earnerEarnings},
          ${now}::timestamp without time zone, ${earner.type}::"EarnType", ${earner.id}::INTEGER,
          ${earner.rank}::INTEGER)`

        const userN = notifications[earner.userId] || {}

        // sum total
        const prevMsats = userN.msats || 0
        const msats = earnerEarnings + prevMsats

        // sum total per earn type (POST, COMMENT, TIP_COMMENT, TIP_POST)
        const prevEarnTypeMsats = userN[earner.type]?.msats || 0
        const earnTypeMsats = earnerEarnings + prevEarnTypeMsats

        // best (=lowest) rank per earn type
        const prevEarnTypeBestRank = userN[earner.type]?.bestRank
        const earnTypeBestRank = prevEarnTypeBestRank
          ? Math.min(prevEarnTypeBestRank, Number(earner.rank))
          : Number(earner.rank)

        notifications[earner.userId] = {
          ...userN,
          msats,
          [earner.type]: { msats: earnTypeMsats, bestRank: earnTypeBestRank }
        }
      }

      if (!earner.foreverReferrerId && earner.oneDayReferrerId) {
        earner.foreverReferrerId = earner.oneDayReferrerId
      }

      if (earner.foreverReferrerId && foreverReferrerEarnings > 0) {
        await models.$executeRaw`SELECT earn(${earner.foreverReferrerId}::INTEGER,
          ${foreverReferrerEarnings}, ${now}::timestamp without time zone,
          'FOREVER_REFERRAL'::"EarnType", ${earner.userId}::INTEGER,
          ${earner.rank}::INTEGER)`
      }

      if (!earner.oneDayReferrerId && earner.foreverReferrerId) {
        earner.oneDayReferrerId = earner.foreverReferrerId
      }

      if (earner.oneDayReferrerId && oneDayReferrerEarnings > 0) {
        await models.$executeRaw`SELECT earn(${earner.oneDayReferrerId}::INTEGER,
          ${oneDayReferrerEarnings}, ${now}::timestamp without time zone,
          'ONE_DAY_REFERRAL'::"EarnType", ${earner.userId}::INTEGER, ${earner.rank}::INTEGER)`
      }
    }

    Promise.allSettled(
      Object.entries(notifications).map(([userId, earnings]) => notifyEarner(parseInt(userId, 10), earnings))
    ).catch(console.error)
  } finally {
    models.$disconnect().catch(console.error)
  }
}
