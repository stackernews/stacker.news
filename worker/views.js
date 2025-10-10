import createPrisma from '@/lib/create-prisma'

const viewPrefixes = ['agg_registrations', 'agg_rewards', 'agg_payin', 'agg_payout']

// this is intended to be run everyday after midnight CT
export async function views ({ data: { period } = { period: 'days' } }) {
  // grab a greedy connection
  const models = createPrisma({ connectionParams: { connection_limit: 1 } })

  try {
    for (const view of viewPrefixes) {
      await models.$executeRawUnsafe(`PERFORM refresh_${view}_${period.slice(0, -1)}()`)
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
    for (const view of ['hot_score_view']) {
      await models.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`)
    }
  } finally {
    await models.$disconnect()
  }
}
