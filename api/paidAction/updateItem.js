import { imageFeesInfo } from '../resolvers/image'
import { getMentions, performBotBehavior } from './lib/item'

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

export async function perform (args, context) {
  const { id, boost = 0, uploadIds = [], pollOptions = [], itemForwards = [], ...data } = args
  const { tx, me } = context
  const boostMsats = BigInt(boost) * BigInt(1000)

  const itemActs = []
  if (boostMsats > 0) {
    itemActs.push({
      msats: boostMsats, act: 'BOOST', userId: me.id
    })
  }

  const threadSubscriptions = [{ userId: me.id },
    ...itemForwards.map(({ userId }) => ({ userId }))]
  const mentions = await getMentions(args, context)

  const result = await tx.item.update({
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
      mention: {
        deleteMany: {
          userId: {
            not: {
              in: mentions.map(({ userId }) => userId)
            }
          }
        },
        createMany: mentions
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
  })

  if (data.maxBid) {
    await tx.$executeRaw`SELECT run_auction(${id}::INTEGER)`
  }

  await tx.$executeRaw`INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', ${id}::INTEGER), 21, true, now() + interval '5 seconds')`

  await performBotBehavior(args, context)

  return result
}

export async function describe ({ id, parentId }, context) {
  return `SN: update ${parentId ? `reply to #${parentId}` : 'post'}`
}
