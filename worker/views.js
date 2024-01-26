import { PrismaClient } from '@prisma/client'

const viewPrefixes = ['reg_growth', 'spender_growth', 'item_growth', 'spending_growth',
  'stackers_growth', 'stacking_growth', 'user_stats']

// this is intended to be run everyday after midnight CT
export async function views ({ data: { period } = { period: 'days' } }) {
  // grab a greedy connection
  const models = new PrismaClient()

  try {
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
  const models = new PrismaClient()

  try {
    for (const view of ['zap_rank_personal_view']) {
      await models.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`)
    }
  } finally {
    await models.$disconnect()
  }
}
