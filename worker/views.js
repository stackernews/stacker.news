import createPrisma from '@/lib/create-prisma'

const viewPrefixes = ['reg_growth', 'spender_growth', 'item_growth', 'spending_growth',
  'stackers_growth', 'stacking_growth', 'user_stats', 'sub_stats']

// this is intended to be run everyday after midnight CT
export async function views ({ data: { period } = { period: 'days' } }) {
  // grab a greedy connection
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    // these views are bespoke so we can't use the loop
    if (period === 'days') {
      await models.$queryRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY user_values_days')
      await models.$queryRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY rewards_days')
    }
    if (period === 'hours') {
      await models.$queryRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY user_values_today')
      await models.$queryRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY rewards_today')
    }
    for (const view of viewPrefixes) {
      await models.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}_${period}`)
    }
  } finally {
    await models.$disconnect()
  }
}

// this should be run regularly ... like, every 5 minutes (TODO:could be more frequent)
export async function rankViews () {
  // grab a greedy connection
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    await models.$queryRaw`
    WITH changed_rows AS (
      SELECT id,
             (CASE WHEN "Item"."weightedVotes" - "Item"."weightedDownVotes" > 0 THEN
                  GREATEST("Item"."weightedVotes" - "Item"."weightedDownVotes", POWER("Item"."weightedVotes" - "Item"."weightedDownVotes", 1.2))
                ELSE
                  "Item"."weightedVotes" - "Item"."weightedDownVotes"
                END + "Item"."weightedComments"*0.5) + ("Item".boost / 5000)
                / POWER(GREATEST(3, EXTRACT(EPOCH FROM (now() - "Item".created_at))/3600), 1.3) AS new_hot_rank,
             (CASE WHEN "Item"."subWeightedVotes" - "Item"."subWeightedDownVotes" > 0 THEN
                  GREATEST("Item"."subWeightedVotes" - "Item"."subWeightedDownVotes", POWER("Item"."subWeightedVotes" - "Item"."subWeightedDownVotes", 1.2))
                ELSE
                  "Item"."subWeightedVotes" - "Item"."subWeightedDownVotes"
                END + "Item"."weightedComments"*0.5) + ("Item".boost / 5000)
                / POWER(GREATEST(3, EXTRACT(EPOCH FROM (now() - "Item".created_at))/3600), 1.3) AS new_sub_hot_rank
      FROM "Item"
      WHERE "Item"."weightedVotes" > 0 OR "Item"."weightedDownVotes" > 0 OR "Item"."subWeightedVotes" > 0 OR "Item"."subWeightedDownVotes" > 0 OR "Item"."weightedComments" > 0
      OR "Item".boost > 0
    )
    UPDATE "Item"
    SET "hotScore" = changed_rows."new_hot_rank",
        "subHotScore" = changed_rows."new_sub_hot_rank"
    FROM changed_rows
    WHERE "Item".id = changed_rows.id
      AND ("Item"."hotScore" IS DISTINCT FROM changed_rows."new_hot_rank"
        OR "Item"."subHotScore" IS DISTINCT FROM changed_rows."new_sub_hot_rank")`
  } finally {
    await models.$disconnect()
  }
}
