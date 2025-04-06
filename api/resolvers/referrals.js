import { timeUnitForRange, whenRange } from '@/lib/time'
import { viewGroup } from './growth'
import { GqlAuthenticationError } from '@/lib/error'

export default {
  Query: {
    referrals: async (parent, { when, from, to }, { models, me }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const range = whenRange(when, from, to)

      return await models.$queryRawUnsafe(`
        SELECT date_trunc('${timeUnitForRange(range)}', t) at time zone 'America/Chicago' as time,
        json_build_array(
          json_build_object('name', 'referrals', 'value', COALESCE(SUM(referrals), 0)),
          json_build_object('name', 'one day referrals', 'value', COALESCE(SUM(one_day_referrals), 0)),
          json_build_object('name', 'referral sats', 'value', FLOOR(COALESCE(SUM(msats_referrals), 0) / 1000.0)),
          json_build_object('name', 'one day referral sats', 'value', FLOOR(COALESCE(SUM(msats_one_day_referrals), 0) / 1000.0))
        ) AS data
          FROM ${viewGroup(range, 'user_stats')}
          WHERE id = ${me.id}
          GROUP BY time
          ORDER BY time ASC`, ...range)
    }
  }
}
