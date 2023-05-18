function views ({ models }) {
  return async function () {
    console.log('refreshing views')

    for (const view of ['reg_growth_days', 'spender_growth_days', 'item_growth_days',
      'spending_growth_days', 'stackers_growth_days', 'stacking_growth_days']) {
      await models.$queryRaw(`REFRESH MATERIALIZED VIEW ${view}`)
    }

    console.log('done refreshing views')
  }
}

module.exports = { views }
