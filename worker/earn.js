import createPrisma from '@/lib/create-prisma'
import { USER_ID } from '@/lib/constants'
import pay, { paySystemOnly } from '@/api/payIn'

const TOTAL_UPPER_BOUND_MSATS = 1_000_000_000
const PERCENTILE_CUTOFF = 50
const ZAP_THRESHOLD = 20
const EACH_ZAP_PORTION = 4.0
const EACH_ITEM_PORTION = 4.0
const HANDICAP_IDS = [616, 6030, 4502, 27]
const HANDICAP_ZAP_MULT = 0.5

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
      SELECT "msats"
      FROM "AggRewards"
      WHERE date_trunc('day', "timeBucket") = date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day')
      AND "payInType" IS NULL`

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
    WITH reward_proportions AS (
      WITH item_proportions AS (
            SELECT *,
                CASE WHEN "parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type,
                CASE WHEN "weightedVotes" > 0 THEN "weightedVotes"/(sum("weightedVotes") OVER (PARTITION BY "parentId" IS NULL)) ELSE 0 END AS proportion
            FROM (
                SELECT *,
                    NTILE(100)  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS percentile,
                    ROW_NUMBER()  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS rank
                FROM "Item"
                JOIN LATERAL (
                    SELECT "PayIn".*
                    FROM "ItemPayIn"
                    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ITEM_CREATE'
                    WHERE "ItemPayIn"."itemId" = "Item".id AND ("PayIn"."userId" = "Item"."userId" OR "PayIn"."payInState" = 'PAID')
                    ORDER BY "PayIn"."created_at" DESC
                    LIMIT 1
                ) "PayIn" ON "PayIn".id IS NOT NULL
                WHERE date_trunc('day', "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'),
                AND "weightedVotes" > 0
                AND "deletedAt" IS NULL
                AND NOT bio
            ) x
            WHERE x.percentile <= ${PERCENTILE_CUTOFF}
        ),
        -- get top item zappers of top posts and comments
        item_zapper_islands AS (
            SELECT "PayIn"."userId", item_proportions.id, item_proportions.proportion, item_proportions."parentId",
                "PayIn".mcost as zapped_msats, "PayIn"."payInStateChangedAt" as acted_at,
                ROW_NUMBER() OVER (partition by item_proportions.id order by "PayIn"."payInStateChangedAt" asc)
                - ROW_NUMBER() OVER (partition by item_proportions.id, "PayIn"."userId" order by "PayIn"."payInStateChangedAt" asc) AS island
            FROM item_proportions
            JOIN "ItemPayIn" ON "ItemPayIn"."itemId" = item_proportions.id
            JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ZAP' AND "PayIn"."payInState" = 'PAID'
            WHERE date_trunc('day', "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = date_trunc('day', now() AT TIME ZONE 'America/Chicago' - interval '1 day'),
        ),
        -- isolate contiguous upzaps from the same user on the same item so that when we take the log
        -- of the upzaps it accounts for successive zaps and does not disproportionately reward them
        -- quad root of the total tipped
        item_zappers AS (
            SELECT "userId", item_zapper_islands.id, item_zapper_islands.proportion,
                item_zapper_islands."parentId", GREATEST(power(sum(zapped_msats) / 1000, 0.25), 0) as zapped_msats, min(acted_at) as acted_at
            FROM item_zapper_islands
            GROUP BY "userId", item_zapper_islands.id, item_zapper_islands.proportion, item_zapper_islands."parentId", island
            HAVING sum(zapped_msats) / 1000 > ${ZAP_THRESHOLD}
        ),
        -- the relative contribution of each zapper to the post/comment
        -- early component: 1/ln(early_rank + e - 1)
        -- tipped component: how much they tipped relative to the total tipped for the item
        -- multiplied by the relative rank of the item to the total items
        -- multiplied by the trust of the user
        item_zapper_ratios AS (
            SELECT "userId", sum((2*early_multiplier+1)*tipped_ratio*ratio*handicap_mult) as item_zapper_proportion,
                "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
            FROM (
                SELECT *,
                    1.0/LN(ROW_NUMBER() OVER (partition by item_zappers.id order by acted_at asc) + EXP(1.0) - 1) AS early_multiplier,
                    zapped_msats::float/(sum(zapped_msats) OVER (partition by item_zappers.id)) zapped_msats_proportion,
                    CASE WHEN item_zappers."userId" = ANY(${HANDICAP_IDS}) THEN ${HANDICAP_ZAP_MULT} ELSE 1 END as handicap_mult
                FROM item_zappers
                WHERE zapped_msats > 0
            ) u
            JOIN users on "userId" = users.id
            GROUP BY "userId", "parentId" IS NULL
        )
        SELECT "userId", ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY item_zapper_proportion DESC) as rank,
            item_zapper_proportion/(sum(item_zapper_proportion) OVER (PARTITION BY "isPost"))/${EACH_ZAP_PORTION} as "typeProportion",
            "type", NULL as "typeId"
        FROM item_zapper_ratios
        WHERE item_zapper_proportion > 0
        UNION ALL
        SELECT "userId", rank, item_proportions.proportion/${EACH_ITEM_PORTION} as "typeProportion",
            "type", item_proportions.id as "typeId"
        FROM item_proportions
    ),
    reward_prospects AS (
      SELECT "users"."id" AS "userId",
        array_agg(json_build_object('typeProportion', "typeProportion", 'type', type, 'typeId', typeId, 'rank', rank)) as earns,
        sum("typeProportion") as total_proportion, "users"."referrerId" AS "foreverReferrerId"
      FROM reward_proportions
      JOIN "users" ON "users"."id" = reward_proportions."userId"
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
