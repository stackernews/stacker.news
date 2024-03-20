import { GraphQLError } from 'graphql'
import { withClause, intervalClause } from './growth'
import { timeUnitForRange, whenRange } from '@/lib/time'

export default {
  Query: {
    referrals: async (parent, { when, from, to }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const range = whenRange(when, from, to)

      const [{ totalSats }] = await models.$queryRawUnsafe(`
        SELECT COALESCE(FLOOR(sum(msats) / 1000), 0) as "totalSats"
        FROM "ReferralAct"
        WHERE ${intervalClause(range, 'ReferralAct')}
        AND "ReferralAct"."referrerId" = $3
      `, ...range, Number(me.id))

      const [{ totalReferrals }] = await models.$queryRawUnsafe(`
        SELECT count(*)::INTEGER as "totalReferrals"
        FROM users
        WHERE ${intervalClause(range, 'users')}
        AND "referrerId" = $3
      `, ...range, Number(me.id))

      const stats = await models.$queryRawUnsafe(
        `${withClause(range)}
        SELECT time, json_build_array(
          json_build_object('name', 'referrals', 'value', count(*) FILTER (WHERE act = 'REFERREE')),
          json_build_object('name', 'sats', 'value', FLOOR(COALESCE(sum(msats) FILTER (WHERE act IN ('BOOST', 'STREAM', 'FEE')), 0)))
        ) AS data
        FROM times
        LEFT JOIN
        ((SELECT "ReferralAct".created_at, "ReferralAct".msats / 1000.0 as msats, "ItemAct".act::text as act
          FROM "ReferralAct"
          JOIN "ItemAct" ON "ItemAct".id = "ReferralAct"."itemActId"
          WHERE ${intervalClause(range, 'ReferralAct')}
          AND "ReferralAct"."referrerId" = $3)
        UNION ALL
        (SELECT created_at, 0.0 as sats, 'REFERREE' as act
          FROM users
          WHERE ${intervalClause(range, 'users')}
          AND "referrerId" = $3)) u ON time = date_trunc('${timeUnitForRange(range)}', u.created_at)
        GROUP BY time
        ORDER BY time ASC`, ...range, Number(me.id))

      return {
        totalSats,
        totalReferrals,
        stats
      }
    }
  }
}
