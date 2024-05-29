import { getDeleteAt, getRemindAt } from '@/lib/item'
import { imageFeesInfo } from '../resolvers/image'

export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ id, boost, uploadIds }, { me, models }) {
  // the only reason updating items costs anything is when it has new uploads
  // or more boost
  const old = await models.item.findUnique({ where: { id } })
  const { totalFeesMsats } = await imageFeesInfo(uploadIds, { models, me })
  return BigInt(totalFeesMsats) + (BigInt(boost - old.boost) * BigInt(1000))
}

export async function performStatements (
  { invoiceId, id, uploadIds = [], itemForwards = [], pollOptions = [], boost = 0, ...data },
  { me, models, cost }) {
  const boostMsats = BigInt(boost) * BigInt(1000)

  const itemActs = []
  if (boostMsats > 0) {
    itemActs.push({
      msats: boostMsats, act: 'BOOST', userId: me.id
    })
  }

  const stmts = [
    models.$executeRaw`INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', ${id}::INTEGER), 21, true, now() + interval '5 seconds')`
  ]
  if (data.maxBid) {
    stmts.push(models.$executeRaw`SELECT * FROM run_auction(${id}::INTEGER)`)
  }

  const mentions = []
  const text = data.text
  if (text) {
    const mentionPattern = /\B@[\w_]+/gi
    const names = text.match(mentionPattern)?.map(m => m.slice(1))
    if (names?.length > 0) {
      const users = await models.user.findMany({ where: { name: { in: names } } })
      mentions.push(...users.map(({ id }) => ({ userId: id }))
        .filter(({ userId }) => userId !== me.id))
    }
    data.deleteAt = getDeleteAt(text)
    data.remindAt = getRemindAt(text)
  }

  if (data.deleteAt) {
    stmts.push(models.$queryRaw`
      INSERT INTO pgboss.job (name, data, startafter, expirein)
      VALUES (
        'deleteItem',
        jsonb_build_object('id', ${id}),
        ${data.deleteAt},
        ${data.deleteAt} - now() + interval '1 minute')`)
  }
  if (data.remindAt) {
    stmts.push(models.$queryRaw`
      INSERT INTO pgboss.job (name, data, startafter, expirein)
      VALUES (
        'remindItem',
        jsonb_build_object('id', ${id}),
        ${data.remindAt},
        ${data.remindAt} - now() + interval '1 minute')`)
  }
  if (data.maxBid) {
    stmts.push(models.$executeRaw`SELECT run_auction(${id}::INTEGER)`)
  }

  const threadSubscriptions = [{ userId: me.id },
    ...itemForwards.map(({ userId }) => ({ userId }))]

  return [
    models.item.update({
      where: { id },
      data: {
        ...data,
        boost,
        threadSubscription: {
          deleteMany: {
            userId: {
              not: {
                in: threadSubscriptions.map(({ userId }) => userId)
              }
            }
          },
          createMany: threadSubscriptions
        },
        itemForwards: {
          deleteMany: {
            userId: {
              not: {
                in: itemForwards.map(({ userId }) => userId)
              }
            }
          },
          createMany: itemForwards
        },
        pollOptions: {
          createMany: pollOptions
        },
        itemUploads: {
          disconnect: {
            uploadId: {
              not: {
                in: uploadIds
              }
            }
          },
          connect: uploadIds.map(id => ({ uploadId: id }))
        },
        itemAct: {
          createMany: itemActs
        }
      }
    }),
    ...stmts
  ]
}

export async function resultsToResponse (results, args, context) {
  return results[0]
}

export async function onPaidStatements ({ invoice }, { models }) {
  return []
}

export async function describe ({ id, parentId }, context) {
  return `SN: update ${parentId ? `reply to #${parentId}` : 'post'}`
}
