import { amountSchema, validateSchema } from '@/lib/validate'
import { getAd, getItem } from './item'
import { GqlInputError } from '@/lib/error'
import pay from '../payIn'

let rewardCache

async function updateCachedRewards (models) {
  const rewards = await getActiveRewards(models)
  rewardCache = { rewards, createdAt: Date.now() }
  return rewards
}

async function getCachedActiveRewards (staleIn, models) {
  if (rewardCache) {
    const { rewards, createdAt } = rewardCache
    const expired = createdAt + staleIn < Date.now()
    if (expired) updateCachedRewards(models).catch(console.error)
    return rewards // serve stale rewards
  }
  return await updateCachedRewards(models)
}

async function getActiveRewards (models) {
  return await models.$queryRaw`
      SELECT
        (sum("msats") / 1000)::INT as total,
        date_trunc('day',  (now() AT TIME ZONE 'America/Chicago') + interval '1 day') AT TIME ZONE 'America/Chicago' as time,
        array_agg(json_build_object('name', "payInType", 'value', "msats")) as sources
      FROM "AggRewards"
      WHERE "timeBucket" >= date_trunc('day', now() AT TIME ZONE 'America/Chicago')
      AND "payInType" IS NOT NULL
      AND "granularity" = 'DAY'`
}

async function getRewards (when, models) {
  if (when) {
    if (when.length > 2) {
      throw new GqlInputError('too many dates')
    }
    when.forEach(w => {
      if (isNaN(new Date(w))) {
        throw new GqlInputError('invalid date')
      }
    })
    if (new Date(when[0]) > new Date(when[when.length - 1])) {
      throw new GqlInputError('bad date range')
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
    SELECT (sum("msats") / 1000)::INT as total,
      days_cte.day + interval '1 day' as time,
      array_agg(json_build_object('name', "payInType", 'value', "msats")) as sources
    FROM days_cte
    JOIN "AggRewards" ON "AggRewards"."timeBucket" = days_cte.day
    WHERE "AggRewards"."granularity" = 'DAY'
    GROUP BY days_cte.day
    ORDER BY days_cte.day ASC`

  return results.length ? results : [{ total: 0, time: '0', sources: [] }]
}

export default {
  Query: {
    rewards: async (parent, { when }, { models }) =>
      when ? await getRewards(when, models) : await getCachedActiveRewards(5000, models),
    meRewards: async (parent, { when }, { me, models }) => {
      if (!me) {
        return null
      }

      if (!when || when.length > 2) {
        throw new GqlInputError('bad date range')
      }
      for (const w of when) {
        if (isNaN(new Date(w))) {
          throw new GqlInputError('invalid date')
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
            AND (type IS NULL OR type NOT IN ('FOREVER_REFERRAL', 'ONE_DAY_REFERRAL'))
            AND date_trunc('day', "Earn".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = days_cte.day
            ORDER BY "Earn".msats DESC)
        ) "Earn"
        GROUP BY days_cte.day
        ORDER BY days_cte.day ASC`

      return results
    }
  },
  Rewards: {
    total: async (parent, args, { models }) => {
      if (!parent.total) {
        return 0
      }
      return parent.total
    },
    ad: async (parent, args, { me, models }) => {
      return await getAd(parent, { }, { me, models })
    }
  },
  Mutation: {
    donateToRewards: async (parent, { sats }, { me, models }) => {
      await validateSchema(amountSchema, { amount: sats })

      return await pay('DONATE', { sats }, { me, models })
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
