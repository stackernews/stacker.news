import serialize from '@/api/resolvers/serial.js'
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
    // and Decimal is what prisma maps it to https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#raw-query-type-mapping
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

    // get earners { userId, id, type, rank, proportion }
    const earners = await models.$queryRaw`
      SELECT id AS "userId", proportion, ROW_NUMBER() OVER (ORDER BY proportion DESC) as rank
      FROM user_values(date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'), date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'), '1 day'::INTERVAL, 'day')
      WHERE NOT (id = ANY (${SN_NO_REWARDS_IDS}))
      ORDER BY proportion DESC
      LIMIT 100`

    // in order to group earnings for users we use the same createdAt time for
    // all earnings
    const now = new Date(new Date().getTime())

    // this is just a sanity check because it seems like a good idea
    let total = 0

    const notifications = {}
    for (const [i, earner] of earners.entries()) {
      const earnings = Math.floor(parseFloat(proportions[i] * sum))
      total += earnings
      if (total > sum) {
        console.log(name, 'total exceeds sum', total, '>', sum)
        return
      }

      console.log('stacker', earner.userId, 'earned', earnings, 'proportion', earner.proportion, 'rank', earner.rank, 'type', earner.type)

      if (earnings > 0) {
        await serialize(
          models.$executeRaw`SELECT earn(${earner.userId}::INTEGER, ${earnings},
          ${now}::timestamp without time zone, ${earner.type}::"EarnType", ${earner.id}::INTEGER, ${earner.rank}::INTEGER)`,
          { models }
        )

        const userN = notifications[earner.userId] || {}

        // sum total
        const prevMsats = userN.msats || 0
        const msats = earnings + prevMsats

        // sum total per earn type (POST, COMMENT, TIP_COMMENT, TIP_POST)
        const prevEarnTypeMsats = userN[earner.type]?.msats || 0
        const earnTypeMsats = earnings + prevEarnTypeMsats

        // best (=lowest) rank per earn type
        const prevEarnTypeBestRank = userN[earner.type]?.bestRank
        const earnTypeBestRank = prevEarnTypeBestRank ? Math.min(prevEarnTypeBestRank, Number(earner.rank)) : Number(earner.rank)

        notifications[earner.userId] = {
          ...userN,
          msats,
          [earner.type]: { msats: earnTypeMsats, bestRank: earnTypeBestRank }
        }
      }
    }

    Promise.allSettled(
      Object.entries(notifications).map(([userId, earnings]) => notifyEarner(parseInt(userId, 10), earnings))
    ).catch(console.error)
  } finally {
    models.$disconnect().catch(console.error)
  }
}
