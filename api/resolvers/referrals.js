import { GraphQLError } from 'graphql'
import { withClause, intervalClause, timeUnit } from './growth'

export default {
  Query: {
    referrals: async (parent, { when, from, to }, { models, me }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const fromDate = (from && new Date(from)) || new Date()
      const toDate = (to && new Date(to)) || new Date()

      const [{ totalSats }] = await models.$queryRawUnsafe(`
        SELECT COALESCE(FLOOR(sum(msats) / 1000), 0) as "totalSats"
        FROM "ReferralAct"
        WHERE ${intervalClause(when, '$2', '$3', 'ReferralAct', true)}
        "ReferralAct"."referrerId" = $1
      `, Number(me.id), fromDate, toDate)

      const [{ totalReferrals }] = await models.$queryRawUnsafe(`
        SELECT count(*)::INTEGER as "totalReferrals"
        FROM users
        WHERE ${intervalClause(when, '$2', '$3', 'users', true)}
        "referrerId" = $1
    `, Number(me.id), fromDate, toDate)

      const stats = await models.$queryRawUnsafe(
        `${withClause(when, '$2', '$3')}
        SELECT time, json_build_array(
          json_build_object('name', 'referrals', 'value', count(*) FILTER (WHERE act = 'REFERREE')),
          json_build_object('name', 'sats', 'value', FLOOR(COALESCE(sum(msats) FILTER (WHERE act IN ('BOOST', 'STREAM', 'FEE')), 0)))
        ) AS data
        FROM times
        LEFT JOIN
        ((SELECT "ReferralAct".created_at, "ReferralAct".msats / 1000.0 as msats, "ItemAct".act::text as act
          FROM "ReferralAct"
          JOIN "ItemAct" ON "ItemAct".id = "ReferralAct"."itemActId"
          WHERE ${intervalClause(when, '$2', '$3', 'ReferralAct', true)}
            "ReferralAct"."referrerId" = $1)
        UNION ALL
        (SELECT created_at, 0.0 as sats, 'REFERREE' as act
          FROM users
          WHERE ${intervalClause(when, '$2', '$3', 'users', true)}
            "referrerId" = $1)) u ON time = date_trunc('${timeUnit(when)}', u.created_at)
        GROUP BY time
        ORDER BY time ASC`, Number(me.id), fromDate, toDate)

      return {
        totalSats,
        totalReferrals,
        stats
      }
    }
  }
}
