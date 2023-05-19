
// this is intended to be run everyday after midnight CT
function views ({ models }) {
  return async function () {
    console.log('refreshing stats views')

    for (const view of ['reg_growth_days', 'spender_growth_days', 'item_growth_days',
      'spending_growth_days', 'stackers_growth_days', 'stacking_growth_days',
      'user_stats_days']) {
      await models.$queryRaw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`)
    }

    console.log('done refreshing stats views')
  }
}

module.exports = { views }
