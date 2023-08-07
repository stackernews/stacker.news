import { GraphQLError } from 'graphql'
import { amountSchema, ssValidate } from '../../lib/validate'
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

      if (!lastReward) return { total: 0, sources: [] }

      const [result] = await models.$queryRaw`
        SELECT coalesce(FLOOR(sum(sats)), 0) as total, json_build_array(
          json_build_object('name', 'donations', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'DONATION')), 0)),
          json_build_object('name', 'fees', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type NOT IN ('BOOST', 'STREAM', 'DONATION'))), 0)),
          json_build_object('name', 'boost', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'BOOST')), 0)),
          json_build_object('name', 'jobs', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'STREAM')), 0))
        ) AS sources
        FROM (
          (SELECT ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) / 1000.0 as sats, act::text as type
            FROM "ItemAct"
            LEFT JOIN "ReferralAct" ON "ItemAct".id = "ReferralAct"."itemActId"
            WHERE "ItemAct".created_at > ${lastReward.createdAt} AND "ItemAct".act <> 'TIP')
            UNION ALL
          (SELECT sats::FLOAT, 'DONATION' as type
            FROM "Donation"
            WHERE created_at > ${lastReward.createdAt})
        ) subquery`

      return result
    }
  },
  Mutation: {
    donateToRewards: async (parent, { sats }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await ssValidate(amountSchema, { amount: sats })

      await serialize(models,
        models.$queryRawUnsafe(
          'SELECT donate($1::INTEGER, $2::INTEGER)',
          sats, Number(me.id)))

      return sats
    }
  }
}
