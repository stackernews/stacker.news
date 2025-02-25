import { timeUnitForRange, whenRange } from '@/lib/time'

export function viewIntervalClause (range, view) {
  const unit = timeUnitForRange(range)
  return `"${view}".t >= date_trunc('${unit}', timezone('America/Chicago', $1)) AND date_trunc('${unit}', "${view}".t) <= date_trunc('${unit}', timezone('America/Chicago', $2)) `
}

export function viewGroup (range, view) {
  const unit = timeUnitForRange(range)
  return `(
    (SELECT *
      FROM ${view}_days
      WHERE ${viewIntervalClause(range, `${view}_days`)})
    UNION ALL
    (SELECT *
      FROM ${view}_hours
      WHERE ${viewIntervalClause(range, `${view}_hours`)}
      ${unit === 'hour' ? '' : `AND "${view}_hours".t >= date_trunc('day', timezone('America/Chicago', now()))`})
    UNION ALL
    (SELECT * FROM
      ${view}(
      date_trunc('hour', timezone('America/Chicago', now())),
      date_trunc('hour', timezone('America/Chicago', now())), '1 hour'::INTERVAL, 'hour')
      WHERE "${view}".t >= date_trunc('hour', timezone('America/Chicago', $1))
      AND "${view}".t <= date_trunc('hour', timezone('America/Chicago', $2)))
  ) u`
}

export default {
  Query: {
    registrationGrowth: async (parent, { when, from, to }, { models }) => {
      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time, json_build_array(
          json_build_object('name', 'referrals', 'value', sum(referrals)),
          json_build_object('name', 'organic', 'value', sum(organic))
        ) AS data
        FROM ${viewGroup(range, 'reg_growth')}
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    spenderGrowth: async (parent, { when, to, from }, { models }) => {
      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time, json_build_array(
          json_build_object('name', 'any', 'value', COUNT(DISTINCT "userId")),
          json_build_object('name', 'jobs', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'STREAM')),
          json_build_object('name', 'boost', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'BOOST')),
          json_build_object('name', 'fees', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'FEE')),
          json_build_object('name', 'poll', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'POLL')),
          json_build_object('name', 'downzaps', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'DONT_LIKE_THIS')),
          json_build_object('name', 'zaps', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'TIP')),
          json_build_object('name', 'donation', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'DONATION')),
          json_build_object('name', 'territories', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'TERRITORY'))
        ) AS data
        FROM ${viewGroup(range, 'spender_growth')}
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    itemGrowth: async (parent, { when, to, from }, { models }) => {
      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time, json_build_array(
          json_build_object('name', 'posts', 'value', sum(posts)),
          json_build_object('name', 'comments', 'value', sum(comments)),
          json_build_object('name', 'jobs', 'value', sum(jobs)),
          json_build_object('name', 'zaps', 'value', sum(zaps)),
          json_build_object('name', 'territories', 'value', sum(territories)),
          json_build_object('name', 'comments/posts', 'value', ROUND(sum(comments)/GREATEST(sum(posts), 1), 2))
        ) AS data
        FROM ${viewGroup(range, 'item_growth')}
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    spendingGrowth: async (parent, { when, to, from }, { models }) => {
      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time, json_build_array(
          json_build_object('name', 'jobs', 'value', sum(jobs)),
          json_build_object('name', 'boost', 'value', sum(boost)),
          json_build_object('name', 'fees', 'value', sum(fees)),
          json_build_object('name', 'zaps', 'value', sum(tips)),
          json_build_object('name', 'donations', 'value', sum(donations)),
          json_build_object('name', 'territories', 'value', sum(territories))
        ) AS data
        FROM ${viewGroup(range, 'spending_growth')}
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    stackerGrowth: async (parent, { when, to, from }, { models }) => {
      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time, json_build_array(
          json_build_object('name', 'any', 'value', COUNT(DISTINCT "userId")),
          json_build_object('name', 'posts', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'POST')),
          json_build_object('name', 'comments', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'COMMENT')),
          json_build_object('name', 'rewards', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'EARN')),
          json_build_object('name', 'referrals', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'REFERRAL')),
          json_build_object('name', 'territories', 'value', COUNT(DISTINCT "userId") FILTER (WHERE type = 'REVENUE'))
        ) AS data
        FROM ${viewGroup(range, 'stackers_growth')}
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    stackingGrowth: async (parent, { when, to, from }, { models }) => {
      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time, json_build_array(
          json_build_object('name', 'rewards', 'value', sum(rewards)),
          json_build_object('name', 'posts', 'value', sum(posts)),
          json_build_object('name', 'comments', 'value', sum(comments)),
          json_build_object('name', 'referrals', 'value', sum(referrals)),
          json_build_object('name', 'territories', 'value', sum(territories))
        ) AS data
        FROM ${viewGroup(range, 'stacking_growth')}
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    itemGrowthSubs: async (parent, { when, to, from, sub }, { models }) => {
      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time, json_build_array(
          json_build_object('name', 'posts', 'value', coalesce(sum(posts),0)),
          json_build_object('name', 'comments', 'value', coalesce(sum(comments),0))
        ) AS data
        FROM ${viewGroup(range, 'sub_stats')}
        WHERE sub_name='${sub}'
        GROUP BY time
        ORDER BY time ASC`, ...range)
    },
    revenueGrowthSubs: async (parent, { when, to, from, sub }, { models }) => {
      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time, json_build_array(
          json_build_object('name', 'revenue', 'value', coalesce(sum(msats_revenue/1000),0)),
          json_build_object('name', 'stacking', 'value', coalesce(sum(msats_stacked/1000),0)),
          json_build_object('name', 'spending', 'value', coalesce(sum(msats_spent/1000),0))
        ) AS data
        FROM ${viewGroup(range, 'sub_stats')}
        WHERE sub_name='${sub}'
        GROUP BY time
        ORDER BY time ASC`, ...range)
    }
  }
}
