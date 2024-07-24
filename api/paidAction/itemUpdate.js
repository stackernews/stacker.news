import { USER_ID } from '@/lib/constants'
import { imageFeesInfo } from '../resolvers/image'
import { getItemMentions, getMentions, performBotBehavior } from './lib/item'
import { notifyItemMention, notifyMention } from '@/lib/webPush'
import { satsToMsats } from '@/lib/format'

export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ id, boost = 0, uploadIds }, { me, models }) {
  // the only reason updating items costs anything is when it has new uploads
  // or more boost
  const old = await models.item.findUnique({ where: { id: parseInt(id) } })
  const { totalFeesMsats } = await imageFeesInfo(uploadIds, { models, me })
  return BigInt(totalFeesMsats) + satsToMsats(boost - (old.boost || 0))
}

export async function perform (args, context) {
  const { id, boost = 0, uploadIds = [], options: pollOptions = [], forwardUsers: itemForwards = [], invoiceId, ...data } = args
  const { tx, me, models } = context
  const old = await tx.item.findUnique({
    where: { id: parseInt(id) },
    include: {
      threadSubscriptions: true,
      mentions: true,
      itemForwards: true,
      itemReferrers: true,
      itemUploads: true
    }
  })

  const boostMsats = satsToMsats(boost - (old.boost || 0))
  const itemActs = []
  if (boostMsats > 0) {
    itemActs.push({
      msats: boostMsats, act: 'BOOST', userId: me?.id || USER_ID.anon
    })
  }

  // createMany is the set difference of the new - old
  // deleteMany is the set difference of the old - new
  // updateMany is the intersection of the old and new
  const difference = (a = [], b = [], key = 'userId') => a.filter(x => !b.find(y => y[key] === x[key]))
  const intersectionMerge = (a = [], b = [], key) => a.filter(x => b.find(y => y.userId === x.userId))
    .map(x => ({ [key]: x[key], ...b.find(y => y.userId === x.userId) }))

  const mentions = await getMentions(args, context)
  const itemMentions = await getItemMentions(args, context)
  const itemUploads = uploadIds.map(id => ({ uploadId: id }))

  await tx.upload.updateMany({
    where: { id: { in: uploadIds } },
    data: { paid: true }
  })

  const item = await tx.item.update({
    where: { id: parseInt(id) },
    include: {
      mentions: true,
      itemReferrers: { include: { refereeItem: true } }
    },
    data: {
      ...data,
      boost,
      pollOptions: {
        createMany: {
          data: pollOptions?.map(option => ({ option }))
        }
      },
      itemUploads: {
        create: difference(itemUploads, old.itemUploads, 'uploadId').map(({ uploadId }) => ({ uploadId })),
        deleteMany: {
          uploadId: {
            in: difference(old.itemUploads, itemUploads, 'uploadId').map(({ uploadId }) => uploadId)
          }
        }
      },
      itemActs: {
        createMany: {
          data: itemActs
        }
      },
      itemForwards: {
        deleteMany: {
          userId: {
            in: difference(old.itemForwards, itemForwards).map(({ userId }) => userId)
          }
        },
        createMany: {
          data: difference(itemForwards, old.itemForwards)
        },
        update: intersectionMerge(old.itemForwards, itemForwards, 'id').map(({ id, ...data }) => ({
          where: { id },
          data
        }))
      },
      threadSubscriptions: {
        deleteMany: {
          userId: {
            in: difference(old.itemForwards, itemForwards).map(({ userId }) => userId)
          }
        },
        createMany: {
          data: difference(itemForwards, old.itemForwards).map(({ userId }) => ({ userId }))
        }
      },
      mentions: {
        deleteMany: {
          userId: {
            in: difference(old.mentions, mentions).map(({ userId }) => userId)
          }
        },
        createMany: {
          data: difference(mentions, old.mentions)
        }
      },
      itemReferrers: {
        deleteMany: {
          refereeId: {
            in: difference(old.itemReferrers, itemMentions, 'refereeId').map(({ refereeId }) => refereeId)
          }
        },
        create: difference(itemMentions, old.itemReferrers, 'refereeId')
      }
    }
  })

  await tx.$executeRaw`INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', ${id}::INTEGER), 21, true, now() + interval '5 seconds')`

  await performBotBehavior(args, context)

  // compare timestamps to only notify if mention or item referral was just created to avoid duplicates on edits
  for (const { userId, createdAt } of item.mentions) {
    if (item.updatedAt.getTime() !== createdAt.getTime()) continue
    notifyMention({ models, item, userId }).catch(console.error)
  }
  for (const { refereeItem, createdAt } of item.itemReferrers) {
    if (item.updatedAt.getTime() !== createdAt.getTime()) continue
    notifyItemMention({ models, referrerItem: item, refereeItem }).catch(console.error)
  }

  // ltree is unsupported in Prisma, so we have to query it manually (FUCK!)
  return (await tx.$queryRaw`
    SELECT *, ltree2text(path) AS path, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM "Item" WHERE id = ${parseInt(id)}::INTEGER`
  )[0]
}

export async function describe ({ id, parentId }, context) {
  return `SN: update ${parentId ? `reply to #${parentId}` : 'post'}`
}
