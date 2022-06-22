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
    },
    earnedGrowth: async (parent, args, { models }) => {
      return await models.$queryRaw(
        `SELECT time, count(distinct user_id) as num
        FROM
        ((SELECT date_trunc('month', "ItemAct".created_at) AS time, "Item"."userId" as user_id
          FROM "ItemAct"
          JOIN "Item" on "ItemAct"."itemId" = "Item".id AND "Item"."userId" <> "ItemAct"."userId"
          WHERE date_trunc('month', now_utc()) <> date_trunc('month', "ItemAct".created_at))
        UNION ALL
        (SELECT date_trunc('month', created_at) AS time, "userId" as user_id
          FROM "Earn"
          WHERE date_trunc('month', now_utc()) <> date_trunc('month', created_at))) u
        GROUP BY time
        ORDER BY time ASC`)
    }
  }
}
