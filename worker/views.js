// this is intended to be run everyday after midnight CT
function views ({ models }) {
  return async function () {
    console.log('refreshing stats views')

    for (const view of ['reg_growth_days', 'spender_growth_days', 'item_growth_days',
      'spending_growth_days', 'stackers_growth_days', 'stacking_growth_days',
      'user_stats_days']) {
      await models.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`)
    }

    console.log('done refreshing stats views')
  }
}

// this should be run regularly ... like, every 1-5 minutes
function rankViews ({ models }) {
  return async function () {
    console.log('refreshing rank views')

    for (const view of ['sat_rank_wwm_view', 'sat_rank_tender_view']) {
      await models.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`)
    }

    console.log('done refreshing rank views')
  }
}

module.exports = { views, rankViews }
