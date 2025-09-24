import { whenRange } from '@/lib/time'
import { validateSchema, territorySchema } from '@/lib/validate'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { viewGroup } from './growth'
import { notifyTerritoryTransfer } from '@/lib/webPush'
import performPaidAction from '../paidAction'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { uploadIdsFromText } from './upload'
import { Prisma } from '@prisma/client'
import { ssrLexicalHTMLGenerator } from '@/lib/lexical/utils/ssrLexicalHTMLGenerator'

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
    topSubs: async (parent, { cursor, when, by, from, to, limit }, { models, me }) => {
      const decodedCursor = decodeCursor(cursor)
      const range = whenRange(when, from, to || decodeCursor.time)

      let column
      switch (by) {
        case 'revenue': column = 'revenue'; break
        case 'spent': column = 'spent'; break
        case 'posts': column = 'nposts'; break
        case 'comments': column = 'ncomments'; break
        default: column = 'stacked'; break
      }

      const subs = await models.$queryRawUnsafe(`
          SELECT "Sub".*,
            COALESCE(floor(sum(msats_revenue)/1000), 0) as revenue,
            COALESCE(floor(sum(msats_stacked)/1000), 0) as stacked,
            COALESCE(floor(sum(msats_spent)/1000), 0) as spent,
            COALESCE(sum(posts), 0) as nposts,
            COALESCE(sum(comments), 0) as ncomments
          FROM ${viewGroup(range, 'sub_stats')}
          JOIN "Sub" on "Sub".name = u.sub_name
          GROUP BY "Sub".name
          ORDER BY ${column} DESC NULLS LAST, "Sub".created_at ASC
          OFFSET $3
          LIMIT $4`, ...range, decodedCursor.offset, limit)

      return {
        cursor: subs.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
        subs
      }
    },
    userSubs: async (_parent, { name, cursor, when, by, from, to, limit }, { models, me }) => {
      if (!name) {
        throw new GqlInputError('must supply user name')
      }

      const user = await models.user.findUnique({ where: { name } })
      if (!user) {
        throw new GqlInputError('no user has that name')
      }

      const decodedCursor = decodeCursor(cursor)
      const range = whenRange(when, from, to || decodeCursor.time)

      let column
      switch (by) {
        case 'revenue': column = 'revenue'; break
        case 'spent': column = 'spent'; break
        case 'posts': column = 'nposts'; break
        case 'comments': column = 'ncomments'; break
        default: column = 'stacked'; break
      }

      const subs = await models.$queryRawUnsafe(`
        SELECT "Sub".*,
          "Sub".created_at as "createdAt",
          COALESCE(floor(sum(msats_revenue)/1000), 0) as revenue,
          COALESCE(floor(sum(msats_stacked)/1000), 0) as stacked,
          COALESCE(floor(sum(msats_spent)/1000), 0) as spent,
          COALESCE(sum(posts), 0) as nposts,
          COALESCE(sum(comments), 0) as ncomments,
          ss."userId" IS NOT NULL as "meSubscription",
          ms."userId" IS NOT NULL as "meMuteSub"
        FROM ${viewGroup(range, 'sub_stats')}
        JOIN "Sub" on "Sub".name = u.sub_name
        LEFT JOIN "SubSubscription" ss ON ss."subName" = "Sub".name AND ss."userId" IS NOT DISTINCT FROM $4
        LEFT JOIN "MuteSub" ms ON ms."subName" = "Sub".name AND ms."userId" IS NOT DISTINCT FROM $4
        WHERE "Sub"."userId" = $3
          AND "Sub".status = 'ACTIVE'
        GROUP BY "Sub".name, ss."userId", ms."userId"
        ORDER BY ${column} DESC NULLS LAST, "Sub".created_at ASC
        OFFSET $5
        LIMIT $6
      `, ...range, user.id, me?.id, decodedCursor.offset, limit)

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

      return await performPaidAction('TERRITORY_BILLING', { name }, { me, models, lnd })
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

      return await performPaidAction('TERRITORY_UNARCHIVE', data, { me, models, lnd })
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
    nposts: async (sub, { when, from, to }, { models }) => {
      if (typeof sub.nposts !== 'undefined') {
        return sub.nposts
      }
    },
    ncomments: async (sub, { when, from, to }, { models }) => {
      if (typeof sub.ncomments !== 'undefined') {
        return sub.ncomments
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
    // if the html conversion fails, we'll use the lexicalState directly
    // this might be a problem for instant content
    data.html = ssrLexicalHTMLGenerator(data.lexicalState)
    return await performPaidAction('TERRITORY_CREATE', data, { me, models, lnd })
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
    // if the html conversion fails, we'll use the lexicalState directly
    // this might be a problem for instant content
    data.html = ssrLexicalHTMLGenerator(data.lexicalState)
    return await performPaidAction('TERRITORY_UPDATE', { oldName, ...data }, { me, models, lnd })
  } catch (error) {
    if (error.code === 'P2002') {
      throw new GqlInputError('name taken')
    }
    throw error
  }
}
