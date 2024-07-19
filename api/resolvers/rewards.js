import { GraphQLError } from 'graphql'
import { amountSchema, ssValidate } from '@/lib/validate'
import { getItem } from './item'
import { topUsers } from './user'
import performPaidAction from '../paidAction'

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
        (sum(total) / 1000)::INT as total,
        date_trunc('day',  (now() AT TIME ZONE 'America/Chicago') + interval '1 day') AT TIME ZONE 'America/Chicago' as time,
        json_build_array(
          json_build_object('name', 'donations', 'value', (sum(donations) / 1000)::INT),
          json_build_object('name', 'fees', 'value', (sum(fees) / 1000)::INT),
          json_build_object('name', 'boost', 'value', (sum(boost) / 1000)::INT),
          json_build_object('name', 'jobs', 'value', (sum(jobs) / 1000)::INT),
          json_build_object('name', 'anon''s stack', 'value', (sum(anons_stack) / 1000)::INT)
        ) AS sources
      FROM (
        (SELECT * FROM rewards_today)
        UNION ALL
        (SELECT * FROM
          rewards(
            date_trunc('hour', timezone('America/Chicago', now())),
            date_trunc('hour', timezone('America/Chicago', now())), '1 hour'::INTERVAL, 'hour'))
      ) u`
}

async function getMonthlyRewards (when, models) {
  return await models.$queryRaw`
      SELECT
        (sum(total) / 1000)::INT as total,
        date_trunc('month',  ${when?.[0]}::text::timestamp) AT TIME ZONE 'America/Chicago' as time,
        json_build_array(
          json_build_object('name', 'donations', 'value', (sum(donations) / 1000)::INT),
          json_build_object('name', 'fees', 'value', (sum(fees) / 1000)::INT),
          json_build_object('name', 'boost', 'value', (sum(boost) / 1000)::INT),
          json_build_object('name', 'jobs', 'value', (sum(jobs) / 1000)::INT),
          json_build_object('name', 'anon''s stack', 'value', (sum(anons_stack) / 1000)::INT)
        ) AS sources
      FROM rewards_days
      WHERE date_trunc('month', rewards_days.t) = date_trunc('month', ${when?.[0]}::text::timestamp - interval '1 month')`
}

async function getRewards (when, models) {
  if (when) {
    if (when.length > 1) {
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

    if (new Date(when[0]).getTime() > new Date('2024-03-01').getTime() && new Date(when[0]).getTime() < new Date('2024-05-02').getTime()) {
      // after 3/1/2024 and until 5/1/2024, we reward monthly on the 1st
      if (new Date(when[0]).getUTCDate() !== 1) {
        throw new GraphQLError('invalid reward date', { extensions: { code: 'BAD_USER_INPUT' } })
      }

      return await getMonthlyRewards(when, models)
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
    SELECT (total / 1000)::INT as total,
      days_cte.day + interval '1 day' as time,
      json_build_array(
        json_build_object('name', 'donations', 'value', donations / 1000),
        json_build_object('name', 'fees', 'value', fees / 1000),
        json_build_object('name', 'boost', 'value', boost / 1000),
        json_build_object('name', 'jobs', 'value', jobs / 1000),
        json_build_object('name', 'anon''s stack', 'value', anons_stack / 1000)
    ) AS sources
    FROM days_cte
    JOIN rewards_days ON rewards_days.t = days_cte.day
    GROUP BY days_cte.day, total, donations, fees, boost, jobs, anons_stack
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
    leaderboard: async (parent, args, { models, ...context }) => {
      // get to and from using postgres because it's easier to do there
      const [{ to, from }] = await models.$queryRaw`
        SELECT date_trunc('day',  (now() AT TIME ZONE 'America/Chicago')) AT TIME ZONE 'America/Chicago' as from,
               (date_trunc('day',  (now() AT TIME ZONE 'America/Chicago')) AT TIME ZONE 'America/Chicago') + interval '1 day - 1 second' as to`
      return await topUsers(parent, { when: 'custom', to: new Date(to).getTime().toString(), from: new Date(from).getTime().toString(), limit: 100 }, { models, ...context })
    },
    total: async (parent, args, { models }) => {
      if (!parent.total) {
        return 0
      }
      return parent.total
    }
  },
  Mutation: {
    donateToRewards: async (parent, { sats }, { me, models, lnd }) => {
      await ssValidate(amountSchema, { amount: sats })

      return await performPaidAction('DONATE', { sats }, { me, models, lnd })
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
