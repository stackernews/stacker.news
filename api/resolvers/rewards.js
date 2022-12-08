import { AuthenticationError } from 'apollo-server-micro'
import serialize from './serial'

export default {
  Query: {
    expectedRewards: async (parent, args, { models }) => {
      // get the last reward time, then get all contributions to rewards since then
      const lastReward = await models.earn.findFirst({
        orderBy: {
          createdAt: 'desc'
        }
      })

      const [result] = await models.$queryRaw`
        SELECT coalesce(sum(sats), 0) as total, json_build_array(
          json_build_object('name', 'donations', 'value', coalesce(sum(sats) FILTER(WHERE type = 'DONATION'), 0)),
          json_build_object('name', 'fees', 'value', coalesce(sum(sats) FILTER(WHERE type NOT IN ('BOOST', 'STREAM')), 0)),
          json_build_object('name', 'boost', 'value', coalesce(sum(sats) FILTER(WHERE type = 'BOOST'), 0)),
          json_build_object('name', 'jobs', 'value', coalesce(sum(sats) FILTER(WHERE type = 'STREAM'), 0))
        ) AS sources
        FROM (
          (SELECT msats / 1000 as sats, act::text as type
            FROM "ItemAct"
            WHERE created_at > ${lastReward.createdAt} AND "ItemAct".act <> 'TIP')
            UNION ALL
          (SELECT sats, 'DONATION' as type
            FROM "Donation"
            WHERE created_at > ${lastReward.createdAt})
        ) subquery`

      return result
    }
  },
  Mutation: {
    donateToRewards: async (parent, { sats }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await serialize(models,
        models.$queryRaw(
          'SELECT donate($1, $2)',
          sats, Number(me.id)))

      return sats
    }
  }
}
