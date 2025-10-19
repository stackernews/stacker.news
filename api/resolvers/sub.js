import { timeUnitForRange, whenRange } from '@/lib/time'
import { validateSchema, territorySchema } from '@/lib/validate'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { notifyTerritoryTransfer } from '@/lib/webPush'
import pay from '../payIn'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { uploadIdsFromText } from './upload'
import { Prisma } from '@prisma/client'

export async function getSub (parent, { name }, { models, me }) {
  if (!name) return null

  return await models.sub.findUnique({
    where: {
      name
    },
    ...(me
      ? {
          include: {
            MuteSub: {
              where: {
                userId: Number(me?.id)
              }
            },
            SubSubscription: {
              where: {
                userId: Number(me?.id)
              }
            }
          }
        }
      : {})
  })
}

export default {
  Query: {
    sub: getSub,
    subSuggestions: async (parent, { q, limit }, { models }) => {
      let subs = []
      subs = await models.$queryRaw`
          SELECT name
          FROM "Sub"
          WHERE status IN ('ACTIVE', 'GRACE')
          ${q ? Prisma.sql`AND SIMILARITY(name, ${q}) > 0.1` : Prisma.empty}
          ${q ? Prisma.sql`ORDER BY SIMILARITY(name, ${q}) DESC` : Prisma.sql`ORDER BY name ASC`}
          LIMIT ${limit}`

      return subs
    },
    subs: async (parent, args, { models, me }) => {
      if (me) {
        const currentUser = await models.user.findUnique({ where: { id: me.id } })
        const showNsfw = currentUser ? currentUser.nsfwMode : false

        return await models.$queryRaw`
          SELECT "Sub".*, "Sub".created_at as "createdAt", ss."userId" IS NOT NULL as "meSubscription", COALESCE(json_agg("MuteSub".*) FILTER (WHERE "MuteSub"."userId" IS NOT NULL), '[]') AS "MuteSub"
          FROM "Sub"
          LEFT JOIN "SubSubscription" ss ON "Sub".name = ss."subName" AND ss."userId" = ${me.id}::INTEGER
          LEFT JOIN "MuteSub" ON "Sub".name = "MuteSub"."subName" AND "MuteSub"."userId" = ${me.id}::INTEGER
          WHERE status <> 'STOPPED' ${showNsfw ? Prisma.empty : Prisma.sql`AND "Sub"."nsfw" = FALSE`}
          GROUP BY "Sub".name, ss."userId", "MuteSub"."userId"
          ORDER BY "Sub".name ASC
        `
      }

      return await models.sub.findMany({
        where: {
          status: {
            not: 'STOPPED'
          },
          nsfw: false
        },
        orderBy: {
          name: 'asc'
        }
      })
    },
    subLatestPost: async (parent, { name }, { models, me }) => {
      const latest = await models.item.findFirst({
        where: {
          subName: name
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return latest?.createdAt
    },
    topSubs: async (parent, { cursor, when, by = 'revenue', from, to, limit }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      const [fromDate, toDate] = whenRange(when, from, to || decodeCursor.time)
      const granularity = timeUnitForRange([fromDate, toDate]).toUpperCase()

      let column
      switch (by) {
        case 'revenue': column = Prisma.sql`revenue`; break
        case 'spent': column = Prisma.sql`spent`; break
        case 'stacked': column = Prisma.sql`stacked`; break
        case 'items': column = Prisma.sql`items`; break
        default: throw new GqlInputError('invalid sort')
      }

      const subs = await models.$queryRaw`
        WITH sub_outgoing AS (
          SELECT "AggPayIn"."subName", floor(sum("AggPayIn"."sumMcost") FILTER (WHERE "AggPayIn"."payInType" = 'ITEM_CREATE') / 1000)  as spent,
            sum("AggPayIn"."countGroup") FILTER (WHERE "AggPayIn"."payInType" = 'ITEM_CREATE') as nitems
          FROM "AggPayIn"
          WHERE "AggPayIn"."timeBucket" >= ${fromDate}
          AND "AggPayIn"."timeBucket" <= ${toDate}
          AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
          AND "AggPayIn"."slice" = 'SUB_BY_TYPE'
          AND "AggPayIn"."subName" IS NOT NULL
          GROUP BY "AggPayIn"."subName"
        ),
        sub_stats AS (
          SELECT "AggPayOut"."subName", COALESCE(sub_outgoing."spent", 0) as spent,
            COALESCE(sub_outgoing."nitems", 0) as nitems,
            floor(sum("AggPayOut"."sumMtokens") FILTER (WHERE "AggPayOut"."payOutType" = 'ZAP') / 1000) as stacked,
            floor(sum("AggPayOut"."sumMtokens") FILTER (WHERE "AggPayOut"."payOutType" = 'TERRITORY_REVENUE') / 1000) as revenue
          FROM "AggPayOut"
          LEFT JOIN sub_outgoing ON "AggPayOut"."subName" = sub_outgoing."subName"
          WHERE "AggPayOut"."timeBucket" >= ${fromDate}
          AND "AggPayOut"."timeBucket" <= ${toDate}
          AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
          AND "AggPayOut"."slice" = 'SUB_BY_TYPE'
          AND "AggPayOut"."subName" IS NOT NULL
          GROUP BY "AggPayOut"."subName", sub_outgoing."spent", sub_outgoing."nitems"
        )
        SELECT * FROM sub_stats
        JOIN "Sub" ON sub_stats."subName" = "Sub".name
        ORDER BY ${column} DESC NULLS LAST, "Sub".created_at ASC
        OFFSET ${decodedCursor.offset}
        LIMIT ${limit}`

      return {
        cursor: subs.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
        subs
      }
    },
    userSubs: async (_parent, { name, cursor, when, by = 'revenue', from, to, limit }, { models, me }) => {
      if (!name) {
        throw new GqlInputError('must supply user name')
      }

      const decodedCursor = decodeCursor(cursor)
      const [fromDate, toDate] = whenRange(when, from, to || decodeCursor.time)
      const granularity = timeUnitForRange([fromDate, toDate]).toUpperCase()

      let column
      switch (by) {
        case 'revenue': column = Prisma.sql`revenue`; break
        case 'spent': column = Prisma.sql`spent`; break
        case 'stacked': column = Prisma.sql`stacked`; break
        case 'items': column = Prisma.sql`items`; break
        default: throw new GqlInputError('invalid sort')
      }

      const subs = await models.$queryRaw`
        WITH user_subs AS (
          SELECT "Sub".name
          FROM "Sub"
          JOIN users ON users.id = "Sub"."userId"
          WHERE users.name = ${name}
          AND "Sub".status = 'ACTIVE'
          GROUP BY "Sub".name
        ),
        sub_outgoing AS (
          SELECT user_subs.name,
            COALESCE(floor(sum("AggPayOut"."sumMtokens") FILTER (WHERE "AggPayOut"."payOutType" = 'TERRITORY_REVENUE') / 1000), 0) as revenue,
            COALESCE(floor(sum("AggPayOut"."sumMtokens") FILTER (WHERE "AggPayOut"."payOutType" = 'ZAP') / 1000), 0) as stacked
          FROM user_subs
          LEFT JOIN "AggPayOut" ON "AggPayOut"."subName" = user_subs.name
          WHERE "AggPayOut"."timeBucket" >= ${fromDate}
          AND "AggPayOut"."timeBucket" <= ${toDate}
          AND "AggPayOut"."granularity" = ${granularity}::"AggGranularity"
          AND "AggPayOut"."slice" = 'SUB_BY_TYPE'
          GROUP BY user_subs.name
        ),
        sub_stats AS (
          SELECT sub_outgoing.name,
            COALESCE(sub_outgoing."revenue", 0) as revenue,
            COALESCE(sub_outgoing."stacked", 0) as stacked,
            COALESCE(floor(sum("AggPayIn"."sumMcost") / 1000), 0) as spent,
            COALESCE(sum("AggPayIn"."countGroup") FILTER (WHERE "AggPayIn"."payInType" = 'ITEM_CREATE'), 0) as nitems
          FROM sub_outgoing
          LEFT JOIN "AggPayIn" ON "AggPayIn"."subName" = sub_outgoing.name
          WHERE "AggPayIn"."timeBucket" >= ${fromDate}
          AND "AggPayIn"."timeBucket" <= ${toDate}
          AND "AggPayIn"."granularity" = ${granularity}::"AggGranularity"
          AND "AggPayIn"."slice" = 'SUB_BY_TYPE'
          GROUP BY sub_outgoing.name, sub_outgoing.revenue, sub_outgoing.stacked
        )
        SELECT * FROM sub_stats
        JOIN "Sub" ON sub_stats.name = "Sub".name
        ORDER BY ${column} DESC NULLS LAST, "Sub".created_at ASC
        OFFSET ${decodedCursor.offset}
        LIMIT ${limit}`

      console.log(granularity, subs)

      return {
        cursor: subs.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
        subs
      }
    },
    mySubscribedSubs: async (parent, { cursor }, { models, me }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const decodedCursor = decodeCursor(cursor)
      const subs = await models.$queryRaw`
        SELECT "Sub".*,
          "MuteSub"."userId" IS NOT NULL as "meMuteSub",
          TRUE as "meSubscription"
        FROM "SubSubscription"
        JOIN "Sub" ON "SubSubscription"."subName" = "Sub".name
        LEFT JOIN "MuteSub" ON "MuteSub"."subName" = "Sub".name AND "MuteSub"."userId" = ${me.id}
        WHERE "SubSubscription"."userId" = ${me.id}
          AND "Sub".status <> 'STOPPED'
        ORDER BY "Sub".name ASC
        OFFSET ${decodedCursor.offset}
        LIMIT ${LIMIT}
      `

      return {
        cursor: subs.length === LIMIT ? nextCursorEncoded(decodedCursor, LIMIT) : null,
        subs
      }
    }
  },
  Mutation: {
    upsertSub: async (parent, { ...data }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await validateSchema(territorySchema, data, { models, me, sub: { name: data.oldName } })

      data.uploadIds = uploadIdsFromText(data.desc)

      if (data.oldName) {
        return await updateSub(parent, data, { me, models, lnd })
      } else {
        return await createSub(parent, data, { me, models, lnd })
      }
    },
    paySub: async (parent, { name }, { me, models, lnd }) => {
      // check that they own the sub
      const sub = await models.sub.findUnique({
        where: {
          name
        }
      })

      if (!sub) {
        throw new GqlInputError('sub not found')
      }

      if (sub.userId !== me.id) {
        throw new GqlInputError('you do not own this sub')
      }

      if (sub.status === 'ACTIVE') {
        return sub
      }

      return await pay('TERRITORY_BILLING', { name }, { me, models, lnd })
    },
    toggleMuteSub: async (parent, { name }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const lookupData = { userId: Number(me.id), subName: name }
      const where = { userId_subName: lookupData }
      const existing = await models.muteSub.findUnique({ where })
      if (existing) {
        await models.muteSub.delete({ where })
        return false
      } else {
        await models.muteSub.create({ data: { ...lookupData } })
        return true
      }
    },
    toggleSubSubscription: async (sub, { name }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const lookupData = { userId: me.id, subName: name }
      const where = { userId_subName: lookupData }
      const existing = await models.subSubscription.findUnique({ where })
      if (existing) {
        await models.subSubscription.delete({ where })
        return false
      } else {
        await models.subSubscription.create({ data: lookupData })
        return true
      }
    },
    transferTerritory: async (parent, { subName, userName }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const sub = await models.sub.findUnique({
        where: {
          name: subName
        }
      })
      if (!sub) {
        throw new GqlInputError('sub not found')
      }
      if (sub.userId !== me.id) {
        throw new GqlInputError('you do not own this sub')
      }

      const user = await models.user.findFirst({ where: { name: userName } })
      if (!user) {
        throw new GqlInputError('user not found')
      }
      if (user.id === me.id) {
        throw new GqlInputError('cannot transfer territory to yourself')
      }

      const [, updatedSub] = await models.$transaction([
        models.territoryTransfer.create({ data: { subName, oldUserId: me.id, newUserId: user.id } }),
        models.sub.update({ where: { name: subName }, data: { userId: user.id, billingAutoRenew: false } })
      ])

      notifyTerritoryTransfer({ models, sub, to: user })

      return updatedSub
    },
    unarchiveTerritory: async (parent, { ...data }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const { name } = data

      await validateSchema(territorySchema, data, { models, me })

      const oldSub = await models.sub.findUnique({ where: { name } })
      if (!oldSub) {
        throw new GqlInputError('sub not found')
      }
      if (oldSub.status !== 'STOPPED') {
        throw new GqlInputError('sub is not archived')
      }
      if (oldSub.billingType === 'ONCE') {
        // sanity check. this should never happen but leaving this comment here
        // to stop error propagation just in case and document that this should never happen.
        // #defensivecode
        throw new GqlInputError('sub should not be archived')
      }

      return await pay('TERRITORY_UNARCHIVE', data, { me, models, lnd })
    }
  },
  Sub: {
    optional: sub => sub,
    user: async (sub, args, { models }) => {
      if (sub.user) {
        return sub.user
      }
      return await models.user.findUnique({ where: { id: sub.userId } })
    },
    meMuteSub: async (sub, args, { models }) => {
      if (sub.meMuteSub !== undefined) {
        return sub.meMuteSub
      }
      return sub.MuteSub?.length > 0
    },
    nitems: async (sub, { when, from, to }, { models }) => {
      if (typeof sub.nitems !== 'undefined') {
        return sub.nitems
      }
    },
    meSubscription: async (sub, args, { me, models }) => {
      if (sub.meSubscription !== undefined) {
        return sub.meSubscription
      }

      return sub.SubSubscription?.length > 0
    },
    createdAt: sub => sub.createdAt || sub.created_at
  }
}

async function createSub (parent, data, { me, models, lnd }) {
  try {
    return await pay('TERRITORY_CREATE', data, { me, models, lnd })
  } catch (error) {
    if (error.code === 'P2002') {
      throw new GqlInputError('name taken')
    }
    throw error
  }
}

async function updateSub (parent, { oldName, ...data }, { me, models, lnd }) {
  const oldSub = await models.sub.findUnique({
    where: {
      name: oldName,
      userId: me.id,
      // this function's logic is only valid if the sub is not stopped
      // so prevent updates to stopped subs
      status: {
        not: 'STOPPED'
      }
    }
  })

  if (!oldSub) {
    throw new GqlInputError('sub not found')
  }

  try {
    return await pay('TERRITORY_UPDATE', { oldName, ...data }, { me, models, lnd })
  } catch (error) {
    if (error.code === 'P2002') {
      throw new GqlInputError('name taken')
    }
    throw error
  }
}
