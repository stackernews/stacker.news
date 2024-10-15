import createPrisma from '@/lib/create-prisma.js'

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

// this should be run regularly ... like, every 5 minutes
export async function rankViews () {
  // grab a greedy connection
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    for (const view of ['zap_rank_personal_view']) {
      await models.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`)
    }
  } finally {
    await models.$disconnect()
  }
}
