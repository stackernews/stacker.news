import createPrisma from '@/lib/create-prisma'
import { USER_ID } from '@/lib/constants'
import pay, { paySystemOnly } from '@/api/payIn'

const TOTAL_UPPER_BOUND_MSATS = 1_000_000_000

export async function earn ({ name }) {
  // grab a greedy connection
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    // get the total msats for the day
    // XXX primsa will return a Decimal (https://mikemcl.github.io/decimal.js)
    // because sum of a BIGINT returns a NUMERIC type (https://www.postgresql.org/docs/13/functions-aggregate.html)
    // and Decimal is what prisma maps it to
    // https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#raw-query-type-mapping
    // so check it before coercing to Number
    const [{ totalMsats: totalMsatsDecimal }] = await models.$queryRaw`
      SELECT totalMsats FROM rewards(
          date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'),
          date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'), '1 day'::INTERVAL, 'day')`

    if (!totalMsatsDecimal || totalMsatsDecimal.lessThanOrEqualTo(0)) {
      throw new Error('no rewards to distribute')
    }

    // sanity check
    if (totalMsatsDecimal.greaterThan(TOTAL_UPPER_BOUND_MSATS)) {
      throw new Error('too many rewards to distribute')
    }

    const totalMsats = Number(totalMsatsDecimal)

    console.log('giving away', totalMsats, 'msats')

    // get the stackers reward prospects
    const rewardProspects = await models.$queryRaw`
    WITH reward_prospects AS (
      SELECT "users"."id" AS "userId",
        array_agg(json_build_object('typeProportion', "typeProportion", 'type', type, 'typeId', typeId, 'rank', rank)) as earns,
        sum("typeProportion") as total_proportion, "users"."referrerId" AS "foreverReferrerId"
      FROM reward_prospects(
        date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'),
        date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'), '1 day'::INTERVAL, 'day')
      JOIN "users" ON "users"."id" = reward_prospects."userId"
      GROUP BY "userId", "users"."referrerId"
    )
    SELECT reward_prospects.*, COALESCE(
      mode() WITHIN GROUP (ORDER BY "OneDayReferral"."referrerId"),
        reward_prospects."foreverReferrerId") AS "oneDayReferrerId"
    FROM reward_prospects
    LEFT JOIN "OneDayReferral" ON "OneDayReferral"."refereeId" = reward_prospects."userId"
    WHERE "OneDayReferral".created_at >= date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day')
    AND "OneDayReferral".landing IS NOT TRUE
    GROUP BY reward_prospects."userId", reward_prospects."foreverReferrerId", reward_prospects.reward_prospects, reward_prospects.total_proportion`

    console.log('reward prospects #', rewardProspects.length)

    return await paySystemOnly('REWARDS', { totalMsats, rewardProspects }, { models, me: { id: USER_ID.rewards } })
  } finally {
    models.$disconnect().catch(console.error)
  }
}

const DAILY_STIMULUS_SATS = 25_000
export async function earnRefill ({ models, lnd }) {
  return await pay('DONATE',
    { sats: DAILY_STIMULUS_SATS },
    {
      models,
      me: { id: USER_ID.sn }
    })
}
