import { GraphQLError } from 'graphql'
import { serializeInvoicable } from './serial'
import { TERRITORY_COST_MONTHLY, TERRITORY_COST_ONCE, TERRITORY_COST_YEARLY } from '../../lib/constants'
import { datePivot } from '../../lib/time'
import { ssValidate, territorySchema } from '../../lib/validate'
import { nextBilling, nextNextBilling } from '../../lib/territory'

export function paySubQueries (sub, models) {
  if (sub.billingType === 'ONCE') {
    return []
  }

  const billingAt = nextBilling(sub)
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
        billedLastAt: billingAt,
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
    }),
    models.$executeRaw`
            DELETE FROM pgboss.job
              WHERE name = 'territoryBilling'
              AND data->>'subName' = ${sub.name}
              AND completedon IS NULL`,
    // schedule 'em
    models.$queryRaw`
          INSERT INTO pgboss.job (name, data, startafter, keepuntil) VALUES ('territoryBilling',
            ${JSON.stringify({
              subName: sub.name
            })}::JSONB, ${billAt}, ${datePivot(billAt, { days: 1 })})`
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
        return await models.$queryRaw`
          SELECT "Sub".*, COALESCE(json_agg("MuteSub".*) FILTER (WHERE "MuteSub"."userId" IS NOT NULL), '[]') AS "MuteSub"
          FROM "Sub"
          LEFT JOIN "MuteSub" ON "Sub".name = "MuteSub"."subName" AND "MuteSub"."userId" = ${me.id}::INTEGER
          WHERE status <> 'STOPPED'
          GROUP BY "Sub".name, "MuteSub"."userId"
          ORDER BY "Sub".name ASC
        `
      }

      return await models.sub.findMany({
        where: {
          status: {
            not: 'STOPPED'
          }
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
    user: async (sub, args, { models }) => {
      if (sub.user) {
        return sub.user
      }
      return await models.user.findUnique({ where: { id: sub.userId } })
    },
    meMuteSub: async (sub, args, { models }) => {
      return sub.meMuteSub || sub.MuteSub?.length > 0
    }
  }
}

async function createSub (parent, data, { me, models, lnd, hash, hmac }) {
  const { billingType } = data
  let billingCost = TERRITORY_COST_MONTHLY
  let billAt = datePivot(new Date(), { months: 1 })

  if (billingType === 'ONCE') {
    billingCost = TERRITORY_COST_ONCE
    billAt = null
  } else if (billingType === 'YEARLY') {
    billingCost = TERRITORY_COST_YEARLY
    billAt = datePivot(new Date(), { years: 1 })
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
          billingCost,
          rankingType: 'WOT',
          userId: me.id
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
      }),
      // schedule 'em
      ...(billAt
        ? [models.$queryRaw`
          INSERT INTO pgboss.job (name, data, startafter, keepuntil) VALUES ('territoryBilling',
            ${JSON.stringify({
              subName: data.name
            })}::JSONB, ${billAt}, ${datePivot(billAt, { days: 1 })})`]
        : [])
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
  // prevent modification of billingType
  delete data.billingType

  try {
    const results = await models.$transaction([
      models.sub.update({
        data,
        where: {
          name: oldName,
          userId: me.id
        }
      }),
      models.$queryRaw`
        UPDATE pgboss.job
          SET data = ${JSON.stringify({ subName: data.name })}::JSONB
          WHERE name = 'territoryBilling'
          AND data->>'subName' = ${oldName}`
    ])

    return results[0]
  } catch (error) {
    if (error.code === 'P2002') {
      throw new GraphQLError('name taken', { extensions: { code: 'BAD_INPUT' } })
    }
    throw error
  }
}
