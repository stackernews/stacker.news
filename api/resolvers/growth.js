const PLACEHOLDERS_NUM = 616

export default {
  Query: {
    registrationGrowth: async (parent, args, { models }) => {
      return await models.$queryRaw(
        `SELECT date_trunc('month', created_at) AS time, count(*) as num
        FROM users
        WHERE id > ${PLACEHOLDERS_NUM} AND date_trunc('month', now_utc()) <> date_trunc('month', created_at)
        GROUP BY time
        ORDER BY time ASC`)
    },
    activeGrowth: async (parent, args, { models }) => {
      return await models.$queryRaw(
        `SELECT date_trunc('month', created_at) AS time, count(DISTINCT "userId") as num
        FROM "ItemAct"
        WHERE date_trunc('month', now_utc()) <> date_trunc('month', created_at)
        GROUP BY time
        ORDER BY time ASC`)
    },
    itemGrowth: async (parent, args, { models }) => {
      return await models.$queryRaw(
        `SELECT date_trunc('month', created_at) AS time, count(*) as num
        FROM "Item"
        WHERE date_trunc('month', now_utc()) <> date_trunc('month', created_at)
        GROUP BY time
        ORDER BY time ASC`)
    },
    spentGrowth: async (parent, args, { models }) => {
      return await models.$queryRaw(
        `SELECT date_trunc('month', created_at) AS time, sum(sats) as num
        FROM "ItemAct"
        WHERE date_trunc('month', now_utc()) <> date_trunc('month', created_at)
        GROUP BY time
        ORDER BY time ASC`)
    }
  }
}
