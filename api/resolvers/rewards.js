import { GraphQLError } from 'graphql'
import { amountSchema, ssValidate } from '../../lib/validate'
import { serializeInvoicable } from './serial'
import { ANON_USER_ID } from '../../lib/constants'
import { getItem } from './item'

export default {
  Query: {
    rewards: async (parent, { when }, { models }) => {
      if (when) {
        if (when.length > 2) {
          throw new GraphQLError('too many dates', { extensions: { code: 'BAD_USER_INPUT' } })
        }
        when.forEach(w => {
          if (isNaN(new Date(w))) {
            throw new GraphQLError('invalid date', { extensions: { code: 'BAD_USER_INPUT' } })
          }
        })
        if (new Date(when[0]) > new Date(when[when.length - 1])) {
          throw new GraphQLError('bad date range', { extensions: { code: 'BAD_USER_INPUT' } })
        }
      }

      const results = await models.$queryRaw`
        WITH days_cte (day) AS (
          SELECT date_trunc('day', t)
          FROM generate_series(
            COALESCE(${when?.[0]}::text::timestamp - interval '1 day', now() AT TIME ZONE 'America/Chicago'),
            COALESCE(${when?.[when.length - 1]}::text::timestamp - interval '1 day', now() AT TIME ZONE 'America/Chicago'),
            interval '1 day') AS t
        )
        SELECT coalesce(FLOOR(sum(sats)), 0) as total,
          days_cte.day + interval '1 day' as time,
          json_build_array(
            json_build_object('name', 'donations', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'DONATION')), 0)),
            json_build_object('name', 'fees', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type NOT IN ('BOOST', 'STREAM', 'DONATION', 'ANON'))), 0)),
            json_build_object('name', 'boost', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'BOOST')), 0)),
            json_build_object('name', 'jobs', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'STREAM')), 0)),
            json_build_object('name', 'anon''s stack', 'value', coalesce(FLOOR(sum(sats) FILTER(WHERE type = 'ANON')), 0))
        ) AS sources
        FROM days_cte
        CROSS JOIN LATERAL (
          (SELECT ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) / 1000.0 as sats, act::text as type
            FROM "ItemAct"
            LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
            WHERE date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = days_cte.day AND "ItemAct".act <> 'TIP')
            UNION ALL
          (SELECT sats::FLOAT, 'DONATION' as type
            FROM "Donation"
            WHERE date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = days_cte.day)
            UNION ALL
          -- any earnings from anon's stack that are not forwarded to other users
          (SELECT "ItemAct".msats / 1000.0 as sats, 'ANON' as type
            FROM "Item"
            JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
            LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id
            WHERE "Item"."userId" = ${ANON_USER_ID} AND "ItemAct".act = 'TIP'
            AND date_trunc('day', "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = days_cte.day
            GROUP BY "ItemAct".id, "ItemAct".msats
            HAVING COUNT("ItemForward".id) = 0)
        ) subquery
        GROUP BY days_cte.day
        ORDER BY days_cte.day ASC`

      return results.length ? results : [{ total: 0, time: '0', sources: [] }]
    },
    meRewards: async (parent, { when }, { me, models }) => {
      if (!me) {
        return null
      }

      if (!when || when.length > 2) {
        throw new GraphQLError('invalid date range', { extensions: { code: 'BAD_USER_INPUT' } })
      }
      for (const w of when) {
        if (isNaN(new Date(w))) {
          throw new GraphQLError('invalid date', { extensions: { code: 'BAD_USER_INPUT' } })
        }
      }

      const results = await models.$queryRaw`
        WITH days_cte (day) AS (
          SELECT date_trunc('day', t)
          FROM generate_series(
            ${when[0]}::text::timestamp,
            ${when[when.length - 1]}::text::timestamp,
            interval '1 day') AS t
        )
        SELECT coalesce(sum(sats), 0) as total, json_agg("Earn".*) as rewards
        FROM days_cte
        CROSS JOIN LATERAL (
          (SELECT FLOOR("Earn".msats / 1000.0) as sats, type, rank, "typeId"
            FROM "Earn"
            WHERE "Earn"."userId" = ${me.id}
            AND date_trunc('day', "Earn".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = days_cte.day
            ORDER BY "Earn".msats DESC)
        ) "Earn"
        GROUP BY days_cte.day
        ORDER BY days_cte.day ASC`

      return results
    }
  },
  Mutation: {
    donateToRewards: async (parent, { sats, hash, hmac }, { me, models, lnd }) => {
      await ssValidate(amountSchema, { amount: sats })

      await serializeInvoicable(
        models.$queryRaw`SELECT donate(${sats}::INTEGER, ${me?.id || ANON_USER_ID}::INTEGER)`,
        { models, lnd, hash, hmac, me, enforceFee: sats }
      )

      return sats
    }
  },
  Reward: {
    item: async (reward, args, { me, models }) => {
      if (!reward.typeId) {
        return null
      }

      return getItem(reward, { id: reward.typeId }, { me, models })
    }
  }
}
