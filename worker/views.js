// this is intended to be run everyday after midnight CT
export async function views ({ models }) {
  for (const view of ['reg_growth_days', 'spender_growth_days', 'item_growth_days',
    'spending_growth_days', 'stackers_growth_days', 'stacking_growth_days',
    'user_stats_days']) {
    await models.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`)
  }
}

// this should be run regularly ... like, every 5 minutes
export async function rankViews ({ models }) {
  for (const view of ['zap_rank_personal_view']) {
    await models.$queryRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`)
  }
}
