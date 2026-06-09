import { timeUnitForRange, whenRange } from '@/lib/time'
import { Prisma } from '@prisma/client'

function sliceClause (sub, me) {
  return sub === ALL_SUB
    ? Prisma.sql`"slice" = 'GLOBAL_BY_TYPE'`
    : sub
      ? Prisma.sql`"slice" = 'SUB_BY_TYPE' AND "subId" = ${sub.id}`
      : me
        ? Prisma.sql`"slice" = 'USER_BY_TYPE' AND "userId" = ${me.id}`
        : Prisma.sql`"slice" = 'GLOBAL_BY_TYPE'`
}

// For total unique counts across all types (not sum of per-type counts)
function totalSliceClause (sub, me) {
  return sub === ALL_SUB
    ? Prisma.sql`"slice" = 'GLOBAL'`
    : sub
      ? Prisma.sql`"slice" = 'SUB_TOTAL' AND "subId" = ${sub.id}`
      : me
        ? Prisma.sql`"slice" = 'USER_TOTAL' AND "userId" = ${me.id}`
        : Prisma.sql`"slice" = 'GLOBAL'`
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
  return (sub === ALL_SUB || me)
    ? Prisma.sql`grid."payInType" NOT IN ('WITHDRAWAL', 'AUTO_WITHDRAWAL', 'PROXY_PAYMENT',
      'DEFUNCT_TERRITORY_DAILY_PAYOUT', 'REWARDS', 'BUY_CREDITS')`
    : Prisma.sql`grid."payInType" NOT IN ('DONATE', 'INVITE_GIFT', 'WITHDRAWAL', 'AUTO_WITHDRAWAL',
      'PROXY_PAYMENT', 'DEFUNCT_TERRITORY_DAILY_PAYOUT', 'REWARDS', 'BUY_CREDITS', 'TERRITORY_CREATE',
      'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE')`
}

function stackerPayOutsExcluded (sub, me) {
  return (sub === ALL_SUB || me)
    ? Prisma.sql`grid."payOutType" NOT IN ('PROXY_PAYMENT', 'DEFUNCT_DELAYED_TERRITORY_REVENUE',
      'DEFUNCT_REFERRAL_ACT', 'REWARDS_POOL', 'ROUTING_FEE', 'ROUTING_FEE_REFUND', 'WITHDRAWAL',
      'SYSTEM_REVENUE', 'BUY_CREDITS', 'INVOICE_OVERPAY_SPILLOVER')`
    : Prisma.sql`grid."payOutType" NOT IN ('INVITE_GIFT', 'PROXY_PAYMENT', 'DEFUNCT_DELAYED_TERRITORY_REVENUE',
      'DEFUNCT_REFERRAL_ACT', 'REWARDS_POOL', 'ROUTING_FEE', 'ROUTING_FEE_REFUND', 'WITHDRAWAL', 'SYSTEM_REVENUE',
        'BUY_CREDITS', 'INVOICE_OVERPAY_SPILLOVER')`
}

const ALL_SUB = 'all'

const findSub = async (subName, { subLoader }) => {
  if (subName) {
    return subName === 'all' ? ALL_SUB : await subLoader.load(subName)
  }
  return null
}

export default {
  Query: {
    growthTotals: async (parent, { when, to, from, sub: subName, mine }, ctx) => {
      const { me, models } = ctx
      // Use same timeHelper and grid pattern as time series queries so totals match
      const { granularity, series } = timeHelper(when, from, to)

      const sub = await findSub(subName, ctx)

      // Get spending totals using same grid pattern as spendingGrowth
      const payInResult = await models.$queryRaw`
        WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payInType"
          FROM series, unnest(enum_range(NULL::"PayInType")) domain("payInType")
        )
        SELECT
          COALESCE(SUM("sumMcost"), 0) / 1000 AS spending,
          COALESCE(SUM("countGroup"), 0)::int AS items
        FROM grid
        LEFT JOIN "AggPayIn" ON "AggPayIn"."timeBucket" = grid."timeBucket" AND "AggPayIn"."payInType" = grid."payInType"
        AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        WHERE ${spenderPayInsExcluded(sub, mine ? me : null)}`

      // Get stacking totals using same grid pattern as stackingGrowth
      const payOutResult = await models.$queryRaw`
        WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payOutType"
          FROM series, unnest(enum_range(NULL::"PayOutType")) domain("payOutType")
        )
        SELECT COALESCE(SUM("sumMtokens"), 0) / 1000 AS stacking
        FROM grid
        LEFT JOIN "AggPayOut" ON "AggPayOut"."timeBucket" = grid."timeBucket" AND "AggPayOut"."payOutType" = grid."payOutType"
        AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        AND "AggPayOut"."payInType" IS NULL
        WHERE ${stackerPayOutsExcluded(sub, mine ? me : null)}`

      // Get registration totals (only for global/all view)
      let registrations = null
      if (sub === ALL_SUB && !mine) {
        const regResult = await models.$queryRaw`
          WITH series AS (
            ${series}
          )
          SELECT COALESCE(SUM("count"), 0)::int AS registrations
          FROM "AggRegistrations", series
          WHERE "granularity" = ${granularity}::"AggGranularity"
          AND "AggRegistrations"."timeBucket" = series."timeBucket"`
        registrations = regResult[0]?.registrations || 0
      }

      return {
        spending: payInResult[0]?.spending || 0,
        items: payInResult[0]?.items || 0,
        stacking: payOutResult[0]?.stacking || 0,
        registrations
      }
    },
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
    spenderGrowth: async (parent, { when, to, from, sub: subName, mine }, ctx) => {
      const { me, models } = ctx
      const { granularity, series } = timeHelper(when, from, to)

      const sub = await findSub(subName, ctx)

      const result = await models.$queryRaw`
        WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payInType"
          FROM series, unnest(enum_range(NULL::"PayInType")) domain("payInType")
        ), totals AS (
          SELECT series."timeBucket", COALESCE("countUsers", 0) as total
          FROM series
          LEFT JOIN "AggPayIn" ON "AggPayIn"."timeBucket" = series."timeBucket"
          AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
          AND ${totalSliceClause(sub, mine ? me : null)}
          AND "AggPayIn"."payInType" IS NULL
        )
        SELECT grid."timeBucket" as time,
          (jsonb_agg(jsonb_build_object('name', grid."payInType", 'value', ${countClause(sub, mine ? me : null)}))
          || jsonb_build_array(jsonb_build_object('name', 'total', 'value', totals.total)))::json
          AS data
        FROM grid
        LEFT JOIN "AggPayIn" ON "AggPayIn"."timeBucket" = grid."timeBucket" AND "AggPayIn"."payInType" = grid."payInType"
        AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        JOIN totals ON totals."timeBucket" = grid."timeBucket"
        WHERE ${spenderPayInsExcluded(sub, mine ? me : null)}
        GROUP BY grid."timeBucket", totals.total
        ORDER BY grid."timeBucket" ASC`

      return result
    },
    spendingGrowth: async (parent, { when, to, from, sub: subName, mine }, ctx) => {
      const { me, models } = ctx
      const { granularity, series } = timeHelper(when, from, to)

      const sub = await findSub(subName, ctx)

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
    itemGrowth: async (parent, { when, to, from, sub: subName, mine }, ctx) => {
      const { me, models } = ctx
      const { granularity, series } = timeHelper(when, from, to)

      const sub = await findSub(subName, ctx)

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
    stackerGrowth: async (parent, { when, to, from, sub: subName, mine }, ctx) => {
      const { me, models } = ctx
      const { granularity, series } = timeHelper(when, from, to)

      const sub = await findSub(subName, ctx)

      return await models.$queryRaw`
        WITH series AS (
          ${series}
        ), grid AS (
          SELECT "timeBucket", "payOutType"
          FROM series, unnest(enum_range(NULL::"PayOutType")) domain("payOutType")
        ), totals AS (
          SELECT series."timeBucket", COALESCE("countUsers", 0) as total
          FROM series
          LEFT JOIN "AggPayOut" ON "AggPayOut"."timeBucket" = series."timeBucket"
          AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
          AND ${totalSliceClause(sub, mine ? me : null)}
          AND "AggPayOut"."payInType" IS NULL
          AND "AggPayOut"."payOutType" IS NULL
        )
        SELECT grid."timeBucket" as time,
          (jsonb_agg(jsonb_build_object('name', grid."payOutType", 'value', ${countClause(sub, mine ? me : null)}))
          || jsonb_build_array(jsonb_build_object('name', 'total', 'value', totals.total)))::json
          AS data
        FROM grid
        LEFT JOIN "AggPayOut" ON "AggPayOut"."timeBucket" = grid."timeBucket" AND "AggPayOut"."payOutType" = grid."payOutType"
        AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
        AND ${sliceClause(sub, mine ? me : null)}
        AND "AggPayOut"."payInType" IS NULL
        JOIN totals ON totals."timeBucket" = grid."timeBucket"
        WHERE ${stackerPayOutsExcluded(sub, mine ? me : null)}
        GROUP BY grid."timeBucket", totals.total
        ORDER BY grid."timeBucket" ASC`
    },
    stackingGrowth: async (parent, { when, to, from, sub: subName, mine }, ctx) => {
      const { me, models } = ctx
      const { granularity, series } = timeHelper(when, from, to)

      const sub = await findSub(subName, ctx)

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
