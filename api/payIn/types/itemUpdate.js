import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { uploadFees } from '../../resolvers/upload'
import { getItemMentions, getMentions, performBotBehavior } from '../lib/item'
import { notifyItemMention, notifyMention } from '@/lib/webPush'
import { satsToMsats } from '@/lib/format'

export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getCost (models, { id, boost = 0, uploadIds, bio }, { me }) {
  // the only reason updating items costs anything is when it has new uploads
  // or more boost
  const old = await models.item.findUnique({ where: { id: parseInt(id) }, include: { payIn: true } })
  const { totalFeesMsats } = await uploadFees(uploadIds, { models, me })
  const cost = BigInt(totalFeesMsats) + satsToMsats(boost - old.boost)

  if (cost > 0 && old.payIn.payInState !== 'PAID') {
    throw new Error('cannot update item with unpaid invoice')
  }

  return cost
}

export async function getPayOuts (models, payIn, { id }, { me }) {
  const item = await models.item.findUnique({ where: { id: parseInt(id) }, include: { sub: true } })

  const revenueMsats = payIn.mcost * BigInt(item.sub.rewardsPct) / 100n
  const rewardMsats = payIn.mcost - revenueMsats

  return {
    payOutCustodialTokens: [
      { payOutType: 'TERRITORY_REVENUE', userId: item.sub.userId, mtokens: revenueMsats, custodialTokenType: 'SATS' },
      { payOutType: 'REWARD_POOL', userId: null, mtokens: rewardMsats, custodialTokenType: 'SATS' }
    ]
  }
}

// TODO: this PayInId cannot be associated with the item, what to do?
export async function onPaid (tx, payInId, { me }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { pessimisticEnv: true } })
  const args = payIn.pessimisticEnv.args
  const { id, boost = 0, uploadIds = [], options: pollOptions = [], forwardUsers: itemForwards = [], ...data } = args
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

  const newBoost = boost - old.boost

  // createMany is the set difference of the new - old
  // deleteMany is the set difference of the old - new
  // updateMany is the intersection of the old and new
  const difference = (a = [], b = [], key = 'userId') => a.filter(x => !b.find(y => y[key] === x[key]))
  const intersectionMerge = (a = [], b = [], key) => a.filter(x => b.find(y => y.userId === x.userId))
    .map(x => ({ [key]: x[key], ...b.find(y => y.userId === x.userId) }))

  const mentions = await getMentions(tx, args, { me })
  const itemMentions = await getItemMentions(tx, args, { me })
  const itemUploads = uploadIds.map(id => ({ uploadId: id }))

  // we put boost in the where clause because we don't want to update the boost
  // if it has changed concurrently
  await tx.item.update({
    where: { id: parseInt(id), boost: old.boost },
    data: {
      ...data,
      boost: {
        increment: newBoost
      },
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

  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, keepuntil)
    VALUES ('imgproxy', jsonb_build_object('id', ${id}::INTEGER), 21, true,
              now() + interval '5 seconds', now() + interval '1 day')`

  if (newBoost > 0) {
    await tx.$executeRaw`
      INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, keepuntil)
      VALUES ('expireBoost', jsonb_build_object('id', ${id}::INTEGER), 21, true,
                now() + interval '30 days', now() + interval '40 days')`
  }

  await performBotBehavior(tx, args, { me })
}

export async function nonCriticalSideEffects (models, payInId, { me }) {
  const item = await models.item.findUnique({
    where: { payInId },
    include: {
      mentions: true,
      itemReferrers: { include: { refereeItem: true } },
      user: true
    }
  })
  // compare timestamps to only notify if mention or item referral was just created to avoid duplicates on edits
  for (const { userId, createdAt } of item.mentions) {
    if (item.updatedAt.getTime() !== createdAt.getTime()) continue
    notifyMention({ models, item, userId }).catch(console.error)
  }
  for (const { refereeItem, createdAt } of item.itemReferrers) {
    if (item.updatedAt.getTime() !== createdAt.getTime()) continue
    notifyItemMention({ models, referrerItem: item, refereeItem }).catch(console.error)
  }
}

export async function describe (models, payInId, { me }) {
  const item = await models.item.findUnique({ where: { payInId } })
  return `SN: update ${item.parentId ? `reply to #${item.parentId}` : 'post'}`
}
