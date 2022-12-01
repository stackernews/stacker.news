const PLACEHOLDERS_NUM = 616

function interval (when) {
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

function timeUnit (when) {
  switch (when) {
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

function withClause (when) {
  const ival = interval(when)
  const unit = timeUnit(when)

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
function intervalClause (when, table, and) {
  if (when === 'forever') {
    return and ? '' : 'TRUE'
  }

  return `"${table}".created_at >= now_utc() - interval '${interval(when)}' ${and ? 'AND' : ''} `
}

export default {
  Query: {
    registrationGrowth: async (parent, { when }, { models }) => {
      return await models.$queryRaw(
        `${withClause(when)}
        SELECT time, json_build_array(
          json_build_object('name', 'invited', 'value', count("inviteId")),
          json_build_object('name', 'organic', 'value', count(users.id) FILTER(WHERE id > ${PLACEHOLDERS_NUM}) - count("inviteId"))
        ) AS data
        FROM times
        LEFT JOIN users ON ${intervalClause(when, 'users', true)} time = date_trunc('${timeUnit(when)}', created_at)
        GROUP BY time
        ORDER BY time ASC`)
    },
    spenderGrowth: async (parent, { when }, { models }) => {
      return await models.$queryRaw(
        `${withClause(when)}
        SELECT time, json_build_array(
          json_build_object('name', 'spenders', 'value', count(DISTINCT "userId"))
        ) AS data
        FROM times
        LEFT JOIN "ItemAct" ON ${intervalClause(when, 'ItemAct', true)} time = date_trunc('${timeUnit(when)}', created_at)
        GROUP BY time
        ORDER BY time ASC`)
    },
    itemGrowth: async (parent, { when }, { models }) => {
      return await models.$queryRaw(
        `${withClause(when)}
        SELECT time, json_build_array(
          json_build_object('name', 'comments', 'value', count("parentId")),
          json_build_object('name', 'jobs', 'value', count("subName")),
          json_build_object('name', 'posts', 'value', count("Item".id)-count("parentId")-count("subName"))
        ) AS data
        FROM times
        LEFT JOIN "Item" ON ${intervalClause(when, 'Item', true)} time = date_trunc('${timeUnit(when)}', created_at)
        GROUP BY time
        ORDER BY time ASC`)
    },
    spendingGrowth: async (parent, { when }, { models }) => {
      return await models.$queryRaw(
        `${withClause(when)}
        SELECT time, json_build_array(
          json_build_object('name', 'jobs', 'value', coalesce(floor(sum(CASE WHEN act = 'STREAM' THEN "ItemAct".msats ELSE 0 END)/1000),0)),
          json_build_object('name', 'boost', 'value', coalesce(floor(sum(CASE WHEN act = 'BOOST' THEN "ItemAct".msats ELSE 0 END)/1000),0)),
          json_build_object('name', 'fees', 'value', coalesce(floor(sum(CASE WHEN act NOT IN ('BOOST', 'TIP', 'STREAM') THEN "ItemAct".msats ELSE 0 END)/1000),0)),
          json_build_object('name', 'tips', 'value', coalesce(floor(sum(CASE WHEN act = 'TIP' THEN "ItemAct".msats ELSE 0 END)/1000),0))
        ) AS data
        FROM times
        LEFT JOIN "ItemAct" ON ${intervalClause(when, 'ItemAct', true)} time = date_trunc('${timeUnit(when)}', created_at)
        JOIN "Item" ON "ItemAct"."itemId" = "Item".id
        GROUP BY time
        ORDER BY time ASC`)
    },
    stackerGrowth: async (parent, { when }, { models }) => {
      return await models.$queryRaw(
        `${withClause(when)}
        SELECT time, json_build_array(
          json_build_object('name', 'stackers', 'value', count(distinct user_id))
        ) AS data
        FROM times
        LEFT JOIN
        ((SELECT "ItemAct".created_at, "Item"."userId" as user_id
          FROM "ItemAct"
          JOIN "Item" on "ItemAct"."itemId" = "Item".id
          WHERE ${intervalClause(when, 'ItemAct', true)} "ItemAct".act = 'TIP')
        UNION ALL
        (SELECT created_at, "userId" as user_id
          FROM "Earn"
          WHERE ${intervalClause(when, 'Earn', false)})) u ON time = date_trunc('${timeUnit(when)}', u.created_at)
        GROUP BY time
        ORDER BY time ASC`)
    },
    stackingGrowth: async (parent, { when }, { models }) => {
      return await models.$queryRaw(
        `${withClause(when)}
        SELECT time, json_build_array(
          json_build_object('name', 'rewards', 'value', coalesce(floor(sum(airdrop)/1000),0)),
          json_build_object('name', 'posts', 'value', coalesce(floor(sum(post)/1000),0)),
          json_build_object('name', 'comments', 'value', coalesce(floor(sum(comment)/1000),0))
        ) AS data
        FROM times
        LEFT JOIN
        ((SELECT "ItemAct".created_at, 0 as airdrop,
          CASE WHEN "Item"."parentId" IS NULL THEN 0 ELSE "ItemAct".msats END as comment,
          CASE WHEN "Item"."parentId" IS NULL THEN "ItemAct".msats ELSE 0 END as post
          FROM "ItemAct"
          JOIN "Item" on "ItemAct"."itemId" = "Item".id
          WHERE ${intervalClause(when, 'ItemAct', true)} "ItemAct".act = 'TIP')
        UNION ALL
        (SELECT created_at, msats as airdrop, 0 as post, 0 as comment
          FROM "Earn"
          WHERE ${intervalClause(when, 'Earn', false)})) u ON time = date_trunc('${timeUnit(when)}', u.created_at)
        GROUP BY time
        ORDER BY time ASC`)
    }
  }
}
