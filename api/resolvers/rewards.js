import { GraphQLError } from 'graphql'
import { amountSchema, ssValidate } from '../../lib/validate'
import serialize from './serial'
import { ANON_USER_ID } from '../../lib/constants'

export default {
  Query: {
    rewards: async (parent, { when }, { models }) => {
      if (when && isNaN(new Date(when))) {
        throw new GraphQLError('invalid date', { extensions: { code: 'BAD_USER_INPUT' } })
      }

      const [result] = await models.$queryRaw`
        WITH day_cte (day) AS (
          SELECT COALESCE(${when}::text::timestamp - interval '1 day', date_trunc('day', now() AT TIME ZONE 'America/Chicago'))
        )
        SELECT coalesce(FLOOR(sum(sats)), 0) as total,
          COALESCE(${when}::text::timestamp, date_trunc('day', (now() + interval '1 day') AT TIME ZONE 'America/Chicago')) as time,
          json_build_array(
            json_build_object('name', 'donations', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'DONATION')), 0)),
            json_build_object('name', 'fees', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type NOT IN ('BOOST', 'STREAM', 'DONATION', 'ANON'))), 0)),
            json_build_object('name', 'boost', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'BOOST')), 0)),
            json_build_object('name', 'jobs', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'STREAM')), 0)),
            json_build_object('name', 'anon''s stack', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'ANON')), 0))
        ) AS sources
        FROM day_cte
        CROSS JOIN LATERAL (
          (SELECT ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) / 1000.0 as sats, act::text as type
            FROM "ItemAct"
            LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
            WHERE date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = day_cte.day AND "ItemAct".act <> 'TIP')
            UNION ALL
          (SELECT sats::FLOAT, 'DONATION' as type
            FROM "Donation"
            WHERE date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = day_cte.day)
            UNION ALL
          (SELECT "ItemAct".msats / 1000.0 as sats, 'ANON' as type
            FROM "Item"
            JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
            WHERE "Item"."userId" = ${ANON_USER_ID} AND "ItemAct".act = 'TIP' AND "Item"."fwdUserId" IS NULL
            AND date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = day_cte.day)
        ) subquery`

      return result || { total: 0, time: 0, sources: [] }
    },
    meRewards: async (parent, { when }, { me, models }) => {
      if (!me) {
        return null
      }

      const [result] = await models.$queryRaw`
        WITH day_cte (day) AS (
          SELECT date_trunc('day', ${when}::text::timestamp AT TIME ZONE 'America/Chicago')
        )
        SELECT coalesce(sum(sats), 0) as total, json_agg("Earn".*) as rewards
        FROM day_cte
        CROSS JOIN LATERAL (
          (SELECT FLOOR("Earn".msats / 1000.0) as sats, type, rank
            FROM "Earn"
            WHERE "Earn"."userId" = ${me.id}
            AND date_trunc('day', "Earn".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = day_cte.day
            ORDER BY "Earn".msats DESC)
        ) "Earn"`

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
