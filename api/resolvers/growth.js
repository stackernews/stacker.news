const PLACEHOLDERS_NUM = 616

export function interval (when) {
  switch (when) {
    case 'week':
      return '1 week'
    case 'month':
      return '1 month'
    case 'year':
      return '1 year'
    case 'forever':
      return null
    default:
      return '1 day'
  }
}

export function timeUnit (when) {
  switch (when) {
    case 'custom':
    case 'week':
    case 'month':
      return 'day'
    case 'year':
    case 'forever':
      return 'month'
    default:
      return 'hour'
  }
}

export function withClause (when, from, to) {
  const ival = interval(when)
  const unit = timeUnit(when)

  if (when === 'custom') {
    return `
      WITH range_values AS (
        SELECT date_trunc('${unit}', ${from}) as minval,
              date_trunc('${unit}', ${to}) as maxval),
      times AS (
        SELECT generate_series(minval, maxval, interval '1 ${unit}') as time
        FROM range_values
      )
    `
  }

  return `
    WITH range_values AS (
      SELECT date_trunc('${unit}', ${ival ? "now_utc() - interval '" + ival + "'" : "'2021-06-07'::timestamp"}) as minval,
            date_trunc('${unit}', now_utc()) as maxval),
    times AS (
      SELECT generate_series(minval, maxval, interval '1 ${unit}') as time
      FROM range_values
    )
  `
}

// HACKY AF this is a performance enhancement that allows us to use the created_at indices on tables
export function intervalClause (when, from, to, table, and) {
  const unit = timeUnit(when)
  switch (when) {
    case 'forever':
      return and ? '' : 'TRUE'
    case 'custom':
      return `"${table}".created_at >= ${from} AND "${table}".created_at <= ${to} ${and ? 'AND' : ''} `
    default:
      return `"${table}".created_at >= date_trunc('${unit}', now_utc() - interval '${interval(when)}') ${and ? 'AND' : ''} `
  }
}

export function viewIntervalClause (when, from, to, view, and) {
  function daysBetween (one, another) { // horrible hack for custom case
    return Math.round(Math.abs((+new Date(one)) - (+new Date(another))) / 8.64e7)
  }
  switch (when) {
    case 'forever':
      return and ? '' : 'TRUE'
    case 'custom':
      return `"${view}".day >= date_trunc('day', timezone('America/Chicago', now() - interval '${daysBetween(new Date(), from) + ' days'}')) AND "${view}".day <= date_trunc('day', timezone('America/Chicago', now() - interval '${daysBetween(new Date(), to) + ' days'}')) ${and ? 'AND' : ''} `
    default:
      return `"${view}".day >= date_trunc('day', timezone('America/Chicago', now() - interval '${interval(when)}')) ${and ? 'AND' : ''} `
  }
}

export default {
  Query: {
    registrationGrowth: async (parent, { when, from, to }, { models }) => {
      const fromDate = (from && new Date(from)) || new Date()
      const toDate = (to && new Date(to)) || new Date()
      if (when !== 'day') {
        return await models.$queryRawUnsafe(`
          SELECT date_trunc('${timeUnit(when)}', day) as time, json_build_array(
            json_build_object('name', 'referrals', 'value', sum(referrals)),
            json_build_object('name', 'organic', 'value', sum(organic))
          ) AS data
          FROM reg_growth_days
          WHERE ${viewIntervalClause(when, from, to, 'reg_growth_days', false)}
          GROUP BY time
          ORDER BY time ASC`, fromDate, toDate)
      }

      return await models.$queryRawUnsafe(
        `${withClause(when, '$1', '$2')}
        SELECT time, json_build_array(
          json_build_object('name', 'referrals', 'value', count("referrerId")),
          json_build_object('name', 'organic', 'value', count(users.id) FILTER(WHERE id > ${PLACEHOLDERS_NUM}) - count("inviteId"))
        ) AS data
        FROM times
        LEFT JOIN users ON ${intervalClause(when, from, to, 'users', true)} time = date_trunc('${timeUnit(when)}', created_at)
        GROUP BY time
        ORDER BY time ASC`, fromDate, toDate)
    },
    spenderGrowth: async (parent, { when, from, to }, { models }) => {
      const fromDate = (from && new Date(from)) || new Date()
      const toDate = (to && new Date(to)) || new Date()
      if (when !== 'day') {
        return await models.$queryRawUnsafe(`
          SELECT date_trunc('${timeUnit(when)}', day) as time, json_build_array(
            json_build_object('name', 'any', 'value', floor(avg("any"))),
            json_build_object('name', 'jobs', 'value', floor(avg(jobs))),
            json_build_object('name', 'boost', 'value', floor(avg(boost))),
            json_build_object('name', 'fees', 'value', floor(avg(fees))),
            json_build_object('name', 'zaps', 'value', floor(avg(tips))),
            json_build_object('name', 'donation', 'value', floor(avg(donations)))
          ) AS data
          FROM spender_growth_days
          WHERE ${viewIntervalClause(when, from, to, 'spender_growth_days', false)}
          GROUP BY time
          ORDER BY time ASC`, fromDate, toDate)
      }

      return await models.$queryRawUnsafe(
        `${withClause(when, '$1', '$2')}
        SELECT time, json_build_array(
          json_build_object('name', 'any', 'value', count(DISTINCT "userId")),
          json_build_object('name', 'jobs', 'value', count(DISTINCT "userId") FILTER (WHERE act = 'STREAM')),
          json_build_object('name', 'boost', 'value', count(DISTINCT "userId") FILTER (WHERE act = 'BOOST')),
          json_build_object('name', 'fees', 'value', count(DISTINCT "userId") FILTER (WHERE act = 'FEE')),
          json_build_object('name', 'zaps', 'value', count(DISTINCT "userId") FILTER (WHERE act = 'TIP')),
          json_build_object('name', 'donation', 'value', count(DISTINCT "userId") FILTER (WHERE act = 'DONATION'))
        ) AS data
        FROM times
        LEFT JOIN
        ((SELECT "ItemAct".created_at, "userId", act::text as act
          FROM "ItemAct"
          WHERE ${intervalClause(when, from, to, 'ItemAct', false)})
        UNION ALL
        (SELECT created_at, "userId", 'DONATION' as act
          FROM "Donation"
          WHERE ${intervalClause(when, from, to, 'Donation', false)})) u ON time = date_trunc('${timeUnit(when)}', u.created_at)
        GROUP BY time
        ORDER BY time ASC`, fromDate, toDate)
    },
    itemGrowth: async (parent, { when, from, to }, { models }) => {
      const fromDate = (from && new Date(from)) || new Date()
      const toDate = (to && new Date(to)) || new Date()
      if (when !== 'day') {
        return await models.$queryRawUnsafe(`
          SELECT date_trunc('${timeUnit(when)}', day) as time, json_build_array(
            json_build_object('name', 'posts', 'value', sum(posts)),
            json_build_object('name', 'comments', 'value', sum(comments)),
            json_build_object('name', 'jobs', 'value', sum(jobs)),
            json_build_object('name', 'comments/posts', 'value', ROUND(sum(comments)/GREATEST(sum(posts), 1), 2))
          ) AS data
          FROM item_growth_days
          WHERE ${viewIntervalClause(when, from, to, 'item_growth_days', false)}
          GROUP BY time
          ORDER BY time ASC`, fromDate, toDate)
      }

      return await models.$queryRawUnsafe(
        `${withClause(when, '$1', '$2')}
        SELECT time, json_build_array(
          json_build_object('name', 'comments', 'value', count("parentId")),
          json_build_object('name', 'jobs', 'value', count("subName") FILTER (WHERE "subName" = 'jobs')),
          json_build_object('name', 'posts', 'value', count("Item".id)-count("parentId")-(count("subName") FILTER (WHERE "subName" = 'jobs'))),
          json_build_object('name', 'comments/posts', 'value', ROUND(count("parentId")/GREATEST(count("Item".id)-count("parentId"), 1), 2))
        ) AS data
        FROM times
        LEFT JOIN "Item" ON ${intervalClause(when, from, to, 'Item', true)} time = date_trunc('${timeUnit(when)}', created_at)
        GROUP BY time
        ORDER BY time ASC`, fromDate, toDate)
    },
    spendingGrowth: async (parent, { when, from, to }, { models }) => {
      const fromDate = (from && new Date(from)) || new Date()
      const toDate = (to && new Date(to)) || new Date()
      if (when !== 'day') {
        return await models.$queryRawUnsafe(`
          SELECT date_trunc('${timeUnit(when)}', day) as time, json_build_array(
            json_build_object('name', 'jobs', 'value', sum(jobs)),
            json_build_object('name', 'boost', 'value', sum(boost)),
            json_build_object('name', 'fees', 'value', sum(fees)),
            json_build_object('name', 'zaps', 'value', sum(tips)),
            json_build_object('name', 'donations', 'value', sum(donations))
          ) AS data
          FROM spending_growth_days
          WHERE ${viewIntervalClause(when, from, to, 'spending_growth_days', false)}
          GROUP BY time
          ORDER BY time ASC`, fromDate, toDate)
      }

      return await models.$queryRawUnsafe(
        `${withClause(when, '$1', '$2')}
        SELECT time, json_build_array(
          json_build_object('name', 'jobs', 'value', coalesce(floor(sum(CASE WHEN act = 'STREAM' THEN msats ELSE 0 END)/1000),0)),
          json_build_object('name', 'boost', 'value', coalesce(floor(sum(CASE WHEN act = 'BOOST' THEN msats ELSE 0 END)/1000),0)),
          json_build_object('name', 'fees', 'value', coalesce(floor(sum(CASE WHEN act NOT IN ('BOOST', 'TIP', 'STREAM', 'DONATION') THEN msats ELSE 0 END)/1000),0)),
          json_build_object('name', 'zaps', 'value', coalesce(floor(sum(CASE WHEN act = 'TIP' THEN msats ELSE 0 END)/1000),0)),
          json_build_object('name', 'donations', 'value', coalesce(floor(sum(CASE WHEN act = 'DONATION' THEN msats ELSE 0 END)/1000),0))
        ) AS data
        FROM times
        LEFT JOIN
        ((SELECT "ItemAct".created_at, msats, act::text as act
          FROM "ItemAct"
          WHERE ${intervalClause(when, from, to, 'ItemAct', false)})
        UNION ALL
        (SELECT created_at, sats * 1000 as msats, 'DONATION' as act
          FROM "Donation"
          WHERE ${intervalClause(when, from, to, 'Donation', false)})) u ON time = date_trunc('${timeUnit(when)}', u.created_at)
        GROUP BY time
        ORDER BY time ASC`, fromDate, toDate)
    },
    stackerGrowth: async (parent, { when, from, to }, { models }) => {
      const fromDate = (from && new Date(from)) || new Date()
      const toDate = (to && new Date(to)) || new Date()
      if (when !== 'day') {
        return await models.$queryRawUnsafe(`
          SELECT date_trunc('${timeUnit(when)}', day) as time, json_build_array(
            json_build_object('name', 'any', 'value', floor(avg("any"))),
            json_build_object('name', 'posts', 'value', floor(avg(posts))),
            json_build_object('name', 'comments', 'value', floor(floor(avg(comments)))),
            json_build_object('name', 'rewards', 'value', floor(avg(rewards))),
            json_build_object('name', 'referrals', 'value', floor(avg(referrals)))
          ) AS data
          FROM stackers_growth_days
          WHERE ${viewIntervalClause(when, from, to, 'stackers_growth_days', false)}
          GROUP BY time
          ORDER BY time ASC`, fromDate, toDate)
      }

      return await models.$queryRawUnsafe(
        `${withClause(when, '$1', '$2')}
        SELECT time, json_build_array(
          json_build_object('name', 'any', 'value', count(distinct user_id)),
          json_build_object('name', 'posts', 'value', count(distinct user_id) FILTER (WHERE type = 'POST')),
          json_build_object('name', 'comments', 'value', count(distinct user_id) FILTER (WHERE type = 'COMMENT')),
          json_build_object('name', 'rewards', 'value', count(distinct user_id) FILTER (WHERE type = 'EARN')),
          json_build_object('name', 'referrals', 'value', count(distinct user_id) FILTER (WHERE type = 'REFERRAL'))
        ) AS data
        FROM times
        LEFT JOIN
        ((SELECT "ItemAct".created_at, "Item"."userId" as user_id, CASE WHEN "Item"."parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type
          FROM "ItemAct"
          JOIN "Item" on "ItemAct"."itemId" = "Item".id
          WHERE ${intervalClause(when, from, to, 'ItemAct', true)} "ItemAct".act = 'TIP')
        UNION ALL
        (SELECT created_at, "userId" as user_id, 'EARN' as type
          FROM "Earn"
          WHERE ${intervalClause(when, from, to, 'Earn', false)})
        UNION ALL
          (SELECT created_at, "referrerId" as user_id, 'REFERRAL' as type
            FROM "ReferralAct"
            WHERE ${intervalClause(when, from, to, 'ReferralAct', false)})) u ON time = date_trunc('${timeUnit(when)}', u.created_at)
        GROUP BY time
        ORDER BY time ASC`, fromDate, toDate)
    },
    stackingGrowth: async (parent, { when, from, to }, { models }) => {
      const fromDate = (from && new Date(from)) || new Date()
      const toDate = (to && new Date(to)) || new Date()
      if (when !== 'day') {
        return await models.$queryRawUnsafe(`
          SELECT date_trunc('${timeUnit(when)}', day) as time, json_build_array(
            json_build_object('name', 'rewards', 'value', sum(rewards)),
            json_build_object('name', 'posts', 'value', sum(posts)),
            json_build_object('name', 'comments', 'value', sum(comments)),
            json_build_object('name', 'referrals', 'value', sum(referrals))
          ) AS data
          FROM stacking_growth_days
          WHERE ${viewIntervalClause(when, from, to, 'stacking_growth_days', false)}
          GROUP BY time
          ORDER BY time ASC`, fromDate, toDate)
      }

      return await models.$queryRawUnsafe(
        `${withClause(when, '$1', '$2')}
        SELECT time, json_build_array(
          json_build_object('name', 'rewards', 'value', coalesce(floor(sum(airdrop)/1000),0)),
          json_build_object('name', 'posts', 'value', coalesce(floor(sum(post)/1000),0)),
          json_build_object('name', 'comments', 'value', coalesce(floor(sum(comment)/1000),0)),
          json_build_object('name', 'referrals', 'value', coalesce(floor(sum(referral)/1000),0))
        ) AS data
        FROM times
        LEFT JOIN
        ((SELECT "ItemAct".created_at, 0 as airdrop,
          CASE WHEN "Item"."parentId" IS NULL THEN 0 ELSE "ItemAct".msats END as comment,
          CASE WHEN "Item"."parentId" IS NULL THEN "ItemAct".msats ELSE 0 END as post,
          0 as referral
          FROM "ItemAct"
          JOIN "Item" on "ItemAct"."itemId" = "Item".id
          WHERE ${intervalClause(when, from, to, 'ItemAct', true)} "ItemAct".act = 'TIP')
        UNION ALL
          (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, msats as referral
            FROM "ReferralAct"
            WHERE ${intervalClause(when, from, to, 'ReferralAct', false)})
        UNION ALL
        (SELECT created_at, msats as airdrop, 0 as post, 0 as comment, 0 as referral
          FROM "Earn"
          WHERE ${intervalClause(when, from, to, 'Earn', false)})) u ON time = date_trunc('${timeUnit(when)}', u.created_at)
        GROUP BY time
        ORDER BY time ASC`, fromDate, toDate)
    }
  }
}
