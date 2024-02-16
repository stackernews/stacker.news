import { GraphQLError } from 'graphql'
import { serializeInvoicable } from './serial'
import { TERRITORY_COST_MONTHLY, TERRITORY_COST_ONCE, TERRITORY_COST_YEARLY, TERRITORY_PERIOD_COST } from '../../lib/constants'
import { datePivot, whenRange } from '../../lib/time'
import { ssValidate, territorySchema } from '../../lib/validate'
import { nextNextBilling, proratedBillingCost } from '../../lib/territory'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { subViewGroup } from './growth'

export function paySubQueries (sub, models) {
  if (sub.billingType === 'ONCE') {
    return []
  }

  const billAt = nextNextBilling(sub)
  const cost = BigInt(sub.billingCost) * BigInt(1000)

  return [
    models.user.update({
      where: {
        id: sub.userId
      },
      data: {
        msats: {
          decrement: cost
        }
      }
    }),
    // update 'em
    models.sub.update({
      where: {
        name: sub.name
      },
      data: {
        billedLastAt: sub.billPaidUntil,
        billPaidUntil: billAt,
        status: 'ACTIVE'
      }
    }),
    // record 'em
    models.subAct.create({
      data: {
        userId: sub.userId,
        subName: sub.name,
        msats: cost,
        type: 'BILLING'
      }
    })
  ]
}

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
          SELECT "Sub".*, COALESCE(json_agg("MuteSub".*) FILTER (WHERE "MuteSub"."userId" IS NOT NULL), '[]') AS "MuteSub"
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
          FROM ${subViewGroup(range)} ss
          JOIN "Sub" on "Sub".name = ss.sub_name
          GROUP BY "Sub".name
          ORDER BY ${column} DESC NULLS LAST, "Sub".created_at ASC
          OFFSET $3
          LIMIT $4`, ...range, decodedCursor.offset, limit)

      return {
        cursor: subs.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
        subs
      }
    }
  },
  Mutation: {
    upsertSub: async (parent, { hash, hmac, ...data }, { me, models, lnd }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await ssValidate(territorySchema, data, { models, me })

      if (data.oldName) {
        return await updateSub(parent, data, { me, models, lnd, hash, hmac })
      } else {
        return await createSub(parent, data, { me, models, lnd, hash, hmac })
      }
    },
    paySub: async (parent, { name, hash, hmac }, { me, models, lnd }) => {
      // check that they own the sub
      const sub = await models.sub.findUnique({
        where: {
          name
        }
      })

      if (!sub) {
        throw new GraphQLError('sub not found', { extensions: { code: 'BAD_INPUT' } })
      }

      if (sub.userId !== me.id) {
        throw new GraphQLError('you do not own this sub', { extensions: { code: 'BAD_INPUT' } })
      }

      if (sub.status === 'ACTIVE') {
        return sub
      }

      const queries = paySubQueries(sub, models)
      if (queries.length === 0) {
        return sub
      }

      const results = await serializeInvoicable(
        queries,
        { models, lnd, hash, hmac, me, enforceFee: sub.billingCost })
      return results[1]
    },
    toggleMuteSub: async (parent, { name }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
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
      return sub.meMuteSub || sub.MuteSub?.length > 0
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
    }
  }
}

async function createSub (parent, data, { me, models, lnd, hash, hmac }) {
  const { billingType, nsfw } = data
  let billingCost = TERRITORY_COST_MONTHLY
  let billPaidUntil = datePivot(new Date(), { months: 1 })

  if (billingType === 'ONCE') {
    billingCost = TERRITORY_COST_ONCE
    billPaidUntil = null
  } else if (billingType === 'YEARLY') {
    billingCost = TERRITORY_COST_YEARLY
    billPaidUntil = datePivot(new Date(), { years: 1 })
  }

  const cost = BigInt(1000) * BigInt(billingCost)

  try {
    const results = await serializeInvoicable([
      // bill 'em
      models.user.update({
        where: {
          id: me.id
        },
        data: {
          msats: {
            decrement: cost
          }
        }
      }),
      // create 'em
      models.sub.create({
        data: {
          ...data,
          billPaidUntil,
          billingCost,
          rankingType: 'WOT',
          userId: me.id,
          nsfw
        }
      }),
      // record 'em
      models.subAct.create({
        data: {
          userId: me.id,
          subName: data.name,
          msats: cost,
          type: 'BILLING'
        }
      })
    ], { models, lnd, hash, hmac, me, enforceFee: billingCost })

    return results[1]
  } catch (error) {
    if (error.code === 'P2002') {
      throw new GraphQLError('name taken', { extensions: { code: 'BAD_INPUT' } })
    }
    throw error
  }
}

async function updateSub (parent, { oldName, ...data }, { me, models, lnd, hash, hmac }) {
  const oldSub = await models.sub.findUnique({
    where: {
      name: oldName,
      userId: me.id
    }
  })

  if (!oldSub) {
    throw new GraphQLError('sub not found', { extensions: { code: 'BAD_INPUT' } })
  }

  try {
    // if the cost is changing, record the new cost and update billing job
    if (oldSub.billingType !== data.billingType) {
      // make sure the current cost is recorded so they are grandfathered in
      data.billingCost = TERRITORY_PERIOD_COST(data.billingType)

      // we never want to bill them again if they are changing to ONCE
      if (data.billingType === 'ONCE') {
        data.billPaidUntil = null
      }

      // if they are changing to YEARLY, bill them in a year
      // if they are changing to MONTHLY from YEARLY, do nothing
      if (oldSub.billingType === 'MONTHLY' && data.billingType === 'YEARLY') {
        data.billPaidUntil = datePivot(new Date(oldSub.billedLastAt), { years: 1 })
      }

      // if the billing type is changing such that it's more expensive, bill 'em the difference
      const proratedCost = proratedBillingCost(oldSub, data.billingType)
      if (proratedCost > 0) {
        const cost = BigInt(1000) * BigInt(proratedCost)
        const results = await serializeInvoicable([
          models.user.update({
            where: {
              id: me.id
            },
            data: {
              msats: {
                decrement: cost
              }
            }
          }),
          models.subAct.create({
            data: {
              userId: me.id,
              subName: oldName,
              msats: cost,
              type: 'BILLING'
            }
          }),
          models.sub.update({
            data,
            where: {
              name: oldName,
              userId: me.id
            }
          })
        ], { models, lnd, hash, hmac, me, enforceFee: proratedCost })
        return results[2]
      }
    }

    // if we get here they are changin in a way that doesn't cost them anything
    return await models.sub.update({
      data,
      where: {
        name: oldName,
        userId: me.id
      }
    })
  } catch (error) {
    if (error.code === 'P2002') {
      throw new GraphQLError('name taken', { extensions: { code: 'BAD_INPUT' } })
    }
    throw error
  }
}
