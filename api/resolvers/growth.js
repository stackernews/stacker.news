import { timeUnitForRange, whenRange } from '@/lib/time'
import { Prisma } from '@prisma/client'

function sliceClause (sub, me) {
  return sub === 'all'
    ? Prisma.sql`"slice" = 'GLOBAL_BY_TYPE'`
    : sub
      ? Prisma.sql`"slice" = 'SUB_BY_TYPE' AND "subName" = ${sub}`
      : me
        ? Prisma.sql`"slice" = 'USER_BY_TYPE' AND "userId" = ${me.id}`
        : Prisma.sql`"slice" = 'GLOBAL_BY_TYPE'`
}

function countClause (sub, me) {
  return sub
    ? Prisma.sql`COALESCE("countUsers", 0)`
    : me
      ? Prisma.sql`COALESCE("countGroup", 0)`
      : Prisma.sql`COALESCE("countUsers", 0)`
}

function timeHelper (when, from, to) {
  const [fromDate, toDate] = whenRange(when, from, to)
  const granularity = timeUnitForRange([fromDate, toDate]).toUpperCase()
  const step = Prisma.sql`${`1 ${granularity}`}::interval`
  const clamp = granularity === 'HOUR' ? Prisma.empty : Prisma.sql`- ${step}`
  const series = Prisma.sql`
    SELECT generate_series(date_trunc(${granularity}, ${fromDate}::timestamptz at time zone 'America/Chicago'),
      date_trunc(${granularity},
        ${toDate}::timestamptz at time zone 'America/Chicago' ${clamp}),
        ${step})::timestamp at time zone 'America/Chicago' as "timeBucket"`
  return { fromDate, toDate, granularity, step, series }
}

function spenderPayInsExcluded (sub, me) {
  return (sub === 'all' || me)
    ? Prisma.sql`grid."payInType" NOT IN ('WITHDRAWAL', 'AUTO_WITHDRAWAL', 'PROXY_PAYMENT',
      'DEFUNCT_TERRITORY_DAILY_PAYOUT', 'REWARDS', 'BUY_CREDITS')`
    : Prisma.sql`grid."payInType" NOT IN ('DONATE', 'INVITE_GIFT', 'WITHDRAWAL', 'AUTO_WITHDRAWAL',
      'PROXY_PAYMENT', 'DEFUNCT_TERRITORY_DAILY_PAYOUT', 'REWARDS', 'BUY_CREDITS', 'TERRITORY_CREATE',
      'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE')`
}

function stackerPayOutsExcluded (sub, me) {
  return (sub === 'all' || me)
    ? Prisma.sql`grid."payOutType" NOT IN ('PROXY_PAYMENT', 'DEFUNCT_DELAYED_TERRITORY_REVENUE',
      'DEFUNCT_REFERRAL_ACT', 'REWARDS_POOL', 'ROUTING_FEE', 'ROUTING_FEE_REFUND', 'WITHDRAWAL',
      'SYSTEM_REVENUE', 'BUY_CREDITS', 'INVOICE_OVERPAY_SPILLOVER')`
    : Prisma.sql`grid."payOutType" NOT IN ('INVITE_GIFT', 'PROXY_PAYMENT', 'DEFUNCT_DELAYED_TERRITORY_REVENUE',
      'DEFUNCT_REFERRAL_ACT', 'REWARDS_POOL', 'ROUTING_FEE', 'ROUTING_FEE_REFUND', 'WITHDRAWAL', 'SYSTEM_REVENUE',
        'BUY_CREDITS', 'INVOICE_OVERPAY_SPILLOVER')`
}

export default {
  Query: {
    registrationGrowth: async (parent, { when, from, to }, { models }) => {
      const { granularity, series } = timeHelper(when, from, to)

      return await models.$queryRaw`
        WITH series AS (
          ${series}
        )
        SELECT series."timeBucket" as time, json_build_array(
          json_build_object('name', 'invited', 'value', COALESCE(sum("invitedCount"), 0)),
          json_build_object('name', 'referrals', 'value', COALESCE(sum("referredCount"), 0) - COALESCE(sum("invitedCount"), 0)),
          json_build_object('name', 'organic', 'value', COALESCE(sum("count"), 0) - COALESCE(sum("referredCount"), 0))
        ) AS data
        FROM "AggRegistrations", series
        WHERE "granularity" = ${granularity}::"AggGranularity"
        AND "AggRegistrations"."timeBucket" = series."timeBucket"
        GROUP BY series."timeBucket"
        ORDER BY series."timeBucket" ASC`
    },
    spenderGrowth: async (parent, { when, to, from, sub, mine }, { me, models }) => {
      const { granularity, series } = timeHelper(when, from, to)

      const result = await models.$queryRaw`
        WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payInType"
          FROM series, unnest(enum_range(NULL::"PayInType")) domain("payInType")
        )
        SELECT grid."timeBucket" as time, json_agg(
          json_build_object('name', grid."payInType", 'value', ${countClause(sub, mine ? me : null)})
        ) AS data
        FROM grid
        LEFT JOIN "AggPayIn" ON "AggPayIn"."timeBucket" = grid."timeBucket" AND "AggPayIn"."payInType" = grid."payInType"
        AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        WHERE ${spenderPayInsExcluded(sub, mine ? me : null)}
        GROUP BY grid."timeBucket"
        ORDER BY grid."timeBucket" ASC`

      return result
    },
    spendingGrowth: async (parent, { when, to, from, sub, mine }, { me, models }) => {
      const { granularity, series } = timeHelper(when, from, to)

      return await models.$queryRaw`
         WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payInType"
          FROM series, unnest(enum_range(NULL::"PayInType")) domain("payInType")
        )
        SELECT grid."timeBucket" as time, json_agg(
          json_build_object('name', grid."payInType", 'value', COALESCE("sumMcost", 0) / 1000)
        ) AS data
        FROM grid
        LEFT JOIN "AggPayIn" ON "AggPayIn"."timeBucket" = grid."timeBucket" AND "AggPayIn"."payInType" = grid."payInType"
        AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        WHERE ${spenderPayInsExcluded(sub, mine ? me : null)}
        GROUP BY grid."timeBucket"
        ORDER BY grid."timeBucket" ASC`
    },
    itemGrowth: async (parent, { when, to, from, sub, mine }, { me, models }) => {
      const { granularity, series } = timeHelper(when, from, to)

      const result = await models.$queryRaw`
        WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payInType"
          FROM series, unnest(enum_range(NULL::"PayInType")) domain("payInType")
        )
        SELECT grid."timeBucket" as time, json_agg(
          json_build_object('name', grid."payInType", 'value', COALESCE("countGroup", 0))
        ) AS data
        FROM grid
        LEFT JOIN "AggPayIn" ON "AggPayIn"."timeBucket" = grid."timeBucket" AND "AggPayIn"."payInType" = grid."payInType"
        AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        WHERE ${spenderPayInsExcluded(sub, mine ? me : null)}
        GROUP BY grid."timeBucket"
        ORDER BY grid."timeBucket" ASC`

      return result
    },
    stackerGrowth: async (parent, { when, to, from, sub, mine }, { me, models }) => {
      const { granularity, series } = timeHelper(when, from, to)

      return await models.$queryRaw`
        WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payOutType"
          FROM series, unnest(enum_range(NULL::"PayOutType")) domain("payOutType")
        )
        SELECT grid."timeBucket" as time, json_agg(
          json_build_object('name', grid."payOutType", 'value', ${countClause(sub, mine ? me : null)})
        ) AS data
        FROM grid
        LEFT JOIN "AggPayOut" ON "AggPayOut"."timeBucket" = grid."timeBucket" AND "AggPayOut"."payOutType" = grid."payOutType"
        AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        AND "payInType" IS NULL
        WHERE ${stackerPayOutsExcluded(sub, mine ? me : null)}
        GROUP BY grid."timeBucket"
        ORDER BY grid."timeBucket" ASC`
    },
    stackingGrowth: async (parent, { when, to, from, sub, mine }, { me, models }) => {
      const { granularity, series } = timeHelper(when, from, to)

      return await models.$queryRaw`
        WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payOutType"
          FROM series, unnest(enum_range(NULL::"PayOutType")) domain("payOutType")
        )
        SELECT grid."timeBucket" as time, json_agg(
          json_build_object('name', grid."payOutType", 'value', COALESCE("sumMtokens", 0) / 1000)
        ) AS data
        FROM grid
        LEFT JOIN "AggPayOut" ON "AggPayOut"."timeBucket" = grid."timeBucket" AND "AggPayOut"."payOutType" = grid."payOutType"
        AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        AND "payInType" IS NULL
        WHERE ${stackerPayOutsExcluded(sub, mine ? me : null)}
        GROUP BY grid."timeBucket"
        ORDER BY grid."timeBucket" ASC`
    }
  }
}
