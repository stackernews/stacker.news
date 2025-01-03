import { whenRange } from '@/lib/time'
import { validateSchema, territorySchema } from '@/lib/validate'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { viewGroup } from './growth'
import { notifyTerritoryTransfer } from '@/lib/webPush'
import performPaidAction from '../paidAction'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'

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
    subs: async (parent, args, { models, me }) => {
      if (me) {
        const currentUser = await models.user.findUnique({ where: { id: me.id } })
        const showNsfw = currentUser ? currentUser.nsfwMode : false

        return await models.$queryRawUnsafe(`
          SELECT "Sub".*, "Sub".created_at as "createdAt", COALESCE(json_agg("MuteSub".*) FILTER (WHERE "MuteSub"."userId" IS NOT NULL), '[]') AS "MuteSub"
          FROM "Sub"
          LEFT JOIN "MuteSub" ON "Sub".name = "MuteSub"."subName" AND "MuteSub"."userId" = ${me.id}::INTEGER
          WHERE status <> 'STOPPED' ${showNsfw ? '' : 'AND "Sub"."nsfw" = FALSE'}
          GROUP BY "Sub".name, "MuteSub"."userId"
          ORDER BY "Sub".name ASC
        `)
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
    topSubs: async (parent, { cursor, when, by, from, to, limit = LIMIT }, { models, me }) => {
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
    userSubs: async (_parent, { name, cursor, when, by, from, to, limit = LIMIT }, { models }) => {
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
            COALESCE(sum(comments), 0) as ncomments
          FROM ${viewGroup(range, 'sub_stats')}
          JOIN "Sub" on "Sub".name = u.sub_name
          WHERE "Sub"."userId" = $3
            AND "Sub".status = 'ACTIVE'
          GROUP BY "Sub".name
          ORDER BY ${column} DESC NULLS LAST, "Sub".created_at ASC
          OFFSET $4
          LIMIT $5`, ...range, user.id, decodedCursor.offset, limit)

      return {
        cursor: subs.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
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

      const oldUserId = me.id
      const newUserId = user.id

      if (newUserId === oldUserId) {
        throw new GqlInputError('cannot transfer territory to yourself')
      }

      const updatedSub = await models.$transaction(async tx => {
        await tx.territoryTransfer.create({ data: { subName, oldUserId, newUserId } })
        const updatedSub = await tx.sub.update({ where: { name: subName }, data: { userId: newUserId, billingAutoRenew: false } })

        // unsubscribe the old user
        const oldSubscription = await tx.subSubscription.findUnique({ where: { userId_subName: { userId: oldUserId, subName } } })
        if (oldSubscription) await tx.subSubscription.delete({ where: { userId_subName: { subName, userId: oldUserId } } })

        // subscribe the new user if they aren't already
        // await tx.subSubscription.upsert({
        //   where: { userId_subName: { userId: newUserId, subName } },
        //   update: {},
        //   create: { userId: newUserId, subName }
        // })

        return updatedSub
      })

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
    return await performPaidAction('TERRITORY_UPDATE', { oldName, ...data }, { me, models, lnd })
  } catch (error) {
    if (error.code === 'P2002') {
      throw new GqlInputError('name taken')
    }
    throw error
  }
}
