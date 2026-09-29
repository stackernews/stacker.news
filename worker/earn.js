import createPrisma from '@/lib/create-prisma'
import { SN_NO_REWARDS_IDS, USER_ID } from '@/lib/constants'
import pay from '@/api/payIn'

const TOTAL_UPPER_BOUND_MSATS = 5_000_000_000
const PERCENTILE_CUTOFF = 50
const ZAP_ACCURACY_EXPONENT = 0.25
const MIN_REWARD_ZAP_SATS = 21
const REWARD_SPEND_THRESHOLD_MSATS = 100_000
const REWARD_SPEND_EXPONENT = 0.25
const EACH_ZAP_PORTION = 2.0
const EACH_ITEM_PORTION = 0
const HANDICAP_IDS = [USER_ID.k00b]
const HANDICAP_ZAP_MULT = 0.25

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
    const [{ msats: totalMsatsDecimal }] = await models.$queryRaw`
      SELECT sum("msats") as "msats"
      FROM "AggRewards"
      WHERE "timeBucket" = (date_trunc('day', now() AT TIME ZONE 'America/Chicago') - interval '1 day')
        AT TIME ZONE 'America/Chicago'
      AND "payInType" IS NULL
      AND granularity = 'DAY'`

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
    WITH reward_day AS NOT MATERIALIZED (
      SELECT
        timezone('UTC', timezone('America/Chicago',
          date_trunc('day', timezone('America/Chicago', now())) - interval '1 day')) AS start_at,
        timezone('UTC', timezone('America/Chicago',
          date_trunc('day', timezone('America/Chicago', now())))) AS end_at
    ),
    reward_items AS (
      SELECT id, "userId", "parentId", "weightedVotes", "weightedDownVotes", "deletedAt", bio
      FROM "Item"
      CROSS JOIN reward_day
      WHERE "Item"."paidAt" IS NOT NULL
      -- Match Item_paid_created_id_idx while excluding unpaid items.
      AND COALESCE("Item"."paidAt", "Item".created_at) >= reward_day.start_at
      AND COALESCE("Item"."paidAt", "Item".created_at) < reward_day.end_at
    ),
    ranked_items AS (
      SELECT id, "userId", "parentId" IS NULL AS "isPost", "weightedVotes",
        COUNT(*) OVER (PARTITION BY "parentId" IS NULL) AS item_count,
        ROW_NUMBER() OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") DESC, id ASC) AS rank
      FROM reward_items
      WHERE "weightedVotes" > 0
      AND "deletedAt" IS NULL
      AND NOT bio
    ),
    item_proportions AS (
      SELECT id, "userId", "isPost", rank,
        CASE WHEN "isPost" THEN 'POST' ELSE 'COMMENT' END AS type,
        "weightedVotes" / SUM("weightedVotes") OVER (PARTITION BY "isPost") AS proportion
      FROM ranked_items
      -- Round up for odd counts; item ID breaks ties without expanding the qualifying set.
      WHERE rank <= CEIL(item_count * ${PERCENTILE_CUTOFF} / 100.0)
    ),
    day_zaps AS (
      SELECT "PayIn".id AS "payInId", "PayIn"."userId", "ItemPayIn"."itemId", "PayIn".mcost AS zapped_msats,
        "PayIn"."payInStateChangedAt" AS acted_at
      FROM reward_items
      JOIN "ItemPayIn" ON "ItemPayIn"."itemId" = reward_items.id
      JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId"
      CROSS JOIN reward_day
      WHERE "PayIn"."payInType" = 'ZAP' AND "PayIn"."payInState" = 'PAID'
      AND "PayIn"."payInStateChangedAt" >= reward_day.start_at
      AND "PayIn"."payInStateChangedAt" < reward_day.end_at
    ),
    reward_zaps AS (
      -- Only individual payments reaching the minimum earn rewards or establish a hit.
      SELECT day_zaps.*,
        ROW_NUMBER() OVER (
          PARTITION BY "userId", "itemId"
          ORDER BY acted_at, "payInId"
        ) AS user_zap_number
      FROM day_zaps
      WHERE zapped_msats >= ${MIN_REWARD_ZAP_SATS * 1000}
    ),
    timed_zaps AS (
      SELECT reward_zaps.*,
        -- Count each account once per item; top-ups use the position when paid.
        SUM(CASE WHEN user_zap_number = 1 THEN 1 ELSE 0 END) OVER (
          PARTITION BY "itemId" ORDER BY acted_at, "userId", "payInId" ROWS UNBOUNDED PRECEDING
        ) AS zap_rank
      FROM reward_zaps
    ),
    weighted_zaps AS (
      SELECT timed_zaps.*, 1 / SQRT(zap_rank::float) AS timing_multiplier
      FROM timed_zaps
    ),
    zapped_items AS (
      -- Keep every selected item, including those with only below-minimum payments.
      SELECT day_zaps."userId", day_zaps."itemId",
        COALESCE(SUM(weighted_zaps.zapped_msats), 0) AS reward_msats,
        COALESCE(SUM(weighted_zaps.zapped_msats * weighted_zaps.timing_multiplier), 0) AS timed_reward_msats
      FROM day_zaps
      LEFT JOIN weighted_zaps USING ("payInId")
      GROUP BY day_zaps."userId", day_zaps."itemId"
    ),
    zapper_stats AS (
      -- Raw content accuracy is diagnostic. Rewards count one eligible hit per selected item.
      SELECT zapped_items."userId", reward_items."parentId" IS NULL AS "isPost",
        COUNT(item_proportions.id)::float / COUNT(*) AS accuracy,
        (COUNT(item_proportions.id) FILTER (WHERE zapped_items.reward_msats > 0))::float
          / COUNT(*) AS "rewardAccuracy",
        COALESCE(SUM(zapped_items.reward_msats) FILTER (WHERE item_proportions.id IS NOT NULL), 0) AS "qualifyingZappedMsats"
      FROM zapped_items
      JOIN reward_items ON reward_items.id = zapped_items."itemId"
      LEFT JOIN item_proportions ON item_proportions.id = zapped_items."itemId"
      GROUP BY zapped_items."userId", reward_items."parentId" IS NULL
    ),
    item_zapper_credits AS (
      SELECT zapped_items."userId", item_proportions."isPost", item_proportions.proportion,
        -- Proportional amount weighting cancels the zapper's own total out of the timing average.
        zapped_items.timed_reward_msats / SUM(zapped_items.reward_msats) OVER (PARTITION BY item_proportions.id) AS item_credit
      FROM item_proportions
      JOIN zapped_items ON zapped_items."itemId" = item_proportions.id
      WHERE zapped_items.reward_msats > 0
    ),
    item_zapper_ratios AS (
      -- Weight item credit by the item's share, then apply category accuracy and qualifying spend.
      SELECT z."userId", z."isPost",
        SUM(z.item_credit * z.proportion
          * CASE WHEN z."userId" = ANY(${HANDICAP_IDS}) THEN ${HANDICAP_ZAP_MULT} ELSE 1 END)
          * POWER(zapper_stats."rewardAccuracy", ${ZAP_ACCURACY_EXPONENT})
          -- Spending scales linearly through 100 sats, then by its fourth root.
          * POWER(zapper_stats."qualifyingZappedMsats"::float / ${REWARD_SPEND_THRESHOLD_MSATS},
            CASE WHEN zapper_stats."qualifyingZappedMsats" <= ${REWARD_SPEND_THRESHOLD_MSATS}
              THEN 1 ELSE ${REWARD_SPEND_EXPONENT} END) AS item_zapper_proportion,
        CASE WHEN z."isPost" THEN 'TIP_POST' ELSE 'TIP_COMMENT' END AS type,
        zapper_stats.accuracy, zapper_stats."rewardAccuracy", zapper_stats."qualifyingZappedMsats"
      FROM item_zapper_credits z
      JOIN zapper_stats ON zapper_stats."userId" = z."userId" AND zapper_stats."isPost" = z."isPost"
      GROUP BY z."userId", z."isPost",
        zapper_stats.accuracy, zapper_stats."rewardAccuracy", zapper_stats."qualifyingZappedMsats"
    ),
    reward_proportions AS (
      SELECT "userId", ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY item_zapper_proportion DESC, "userId") AS rank,
        item_zapper_proportion / SUM(item_zapper_proportion) OVER (PARTITION BY "isPost") / ${EACH_ZAP_PORTION} AS "typeProportion",
        type, NULL AS "typeId", accuracy, "rewardAccuracy", "qualifyingZappedMsats"
      FROM item_zapper_ratios
      WHERE item_zapper_proportion > 0
      AND NOT ("userId" = ANY(${SN_NO_REWARDS_IDS}))
      AND ${EACH_ZAP_PORTION} > 0
      UNION ALL
      SELECT "userId", rank, item_proportions.proportion / ${EACH_ITEM_PORTION} AS "typeProportion",
        type, item_proportions.id AS "typeId", NULL::float AS accuracy, NULL::float AS "rewardAccuracy", NULL::numeric AS "qualifyingZappedMsats"
      FROM item_proportions
      WHERE ${EACH_ITEM_PORTION} > 0
      AND NOT ("userId" = ANY(${SN_NO_REWARDS_IDS}))
    ),
    normalized_proportions AS (
      -- A lone active category receives the full pool; otherwise retain the category split.
      SELECT reward_proportions.*,
        "typeProportion" / SUM("typeProportion") OVER () AS normalized_proportion
      FROM reward_proportions
    ),
    reward_prospects AS (
      SELECT "userId",
        json_agg(json_build_object('typeProportion', normalized_proportion, 'type', "type", 'typeId', "typeId", 'rank', rank,
          'accuracy', accuracy, 'rewardAccuracy', "rewardAccuracy", 'qualifyingZappedMsats', "qualifyingZappedMsats"::text)) as earns,
        SUM(normalized_proportion) AS total_proportion
      FROM normalized_proportions
      GROUP BY "userId"
    )
    SELECT reward_prospects.*, users."referrerId" AS "foreverReferrerId", "OneDayReferral"."oneDayReferrerId"
    FROM reward_prospects
    JOIN users ON users.id = reward_prospects."userId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        mode() WITHIN GROUP (ORDER BY "OneDayReferral"."referrerId"),
          users."referrerId") AS "oneDayReferrerId"
      FROM "OneDayReferral"
      CROSS JOIN reward_day
      WHERE "OneDayReferral"."refereeId" = reward_prospects."userId"
        AND "OneDayReferral".created_at >= reward_day.start_at
        AND "OneDayReferral".created_at < reward_day.end_at
        AND "OneDayReferral".landing IS NOT TRUE
    ) "OneDayReferral" ON TRUE`

    console.log('reward prospects #', rewardProspects.length)

    if (!rewardProspects.length) return

    return await pay('REWARDS', { totalMsats, rewardProspects }, { me: { id: USER_ID.rewards }, custodialOnly: true })
  } finally {
    models.$disconnect().catch(console.error)
  }
}

const DAILY_STIMULUS_SATS = 1
export async function earnRefill ({ models, lnd }) {
  return await pay('DONATE',
    { sats: DAILY_STIMULUS_SATS },
    {
      models,
      me: { id: USER_ID.sn },
      custodialOnly: true
    })
}
