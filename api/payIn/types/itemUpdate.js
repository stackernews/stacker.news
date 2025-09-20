import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { uploadFees } from '../../resolvers/upload'
import { getItemMentions, getItemResult, getMentions, getSub, performBotBehavior } from '../lib/item'
import { notifyItemMention, notifyMention } from '@/lib/webPush'
import * as BOOST from './boost'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'
import { satsToMsats } from '@/lib/format'
import * as MEDIA_UPLOAD from './mediaUpload'
import { getBeneficiariesMcost } from '../lib/beneficiaries'
export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

async function getCost (models, { id, boost = 0, uploadIds, bio, newSub, parentId }, { me }) {
  // the only reason updating items costs anything is when it has new uploads
  // or more boost
  const old = await models.item.findUnique({
    where: {
      id: parseInt(id)
    },
    include: {
      itemPayIns: {
        where: {
          payIn: {
            payInType: 'ITEM_CREATE',
            payInState: 'PAID'
          }
        }
      }
    }
  })

  const { totalFeesMsats } = await uploadFees(uploadIds, { models, me })

  let cost = 0n
  if (!parentId && newSub.name !== old.subName) {
    if (old.boost > 0) {
      throw new Error('cannot move boosted items to a different territory')
    }
    cost += satsToMsats(newSub.baseCost)
  }

  if ((cost > 0 || totalFeesMsats > 0 || (boost - old.boost) > 0) && old.itemPayIns.length === 0) {
    throw new Error('cannot increase item cost with unpaid invoice')
  }

  return cost
}

export async function getInitial (models, { id, boost = 0, uploadIds, bio, subName }, { me }) {
  const old = await models.item.findUnique({ where: { id: parseInt(id) } })
  const sub = await getSub(models, { subName, parentId: old.parentId })
  const mcost = await getCost(models, { id, boost, uploadIds, bio, newSub: sub, parentId: old.parentId }, { me })
  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({ sub, mcost })

  const beneficiaries = []
  if (boost - old.boost > 0) {
    beneficiaries.push(await BOOST.getInitial(models, { sats: boost - old.boost, id }, { me, sub }))
  }
  if (uploadIds.length > 0) {
    beneficiaries.push(await MEDIA_UPLOAD.getInitial(models, { uploadIds }, { me, sub }))
  }

  return {
    payInType: 'ITEM_UPDATE',
    userId: me?.id,
    mcost: mcost + getBeneficiariesMcost(beneficiaries),
    payOutCustodialTokens,
    itemPayIn: { itemId: parseInt(id) },
    beneficiaries
  }
}

export async function onBegin (tx, payInId, args) {
  const { id, boost: _, uploadIds = [], options: pollOptions = [], forwardUsers: itemForwards = [], ...data } = args

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

  // createMany is the set difference of the new - old
  // deleteMany is the set difference of the old - new
  // updateMany is the intersection of the old and new
  const difference = (a = [], b = [], key = 'userId') => a.filter(x => !b.find(y => y[key] === x[key]))
  const intersectionMerge = (a = [], b = [], key) => a.filter(x => b.find(y => y.userId === x.userId))
    .map(x => ({ [key]: x[key], ...b.find(y => y.userId === x.userId) }))

  const mentions = await getMentions(tx, args)
  const itemMentions = await getItemMentions(tx, args)
  const itemUploads = uploadIds.map(id => ({ uploadId: id }))

  // we put boost in the where clause because we don't want to update the boost
  // if it has changed concurrently
  await tx.item.update({
    where: { id: parseInt(id) },
    data: {
      ...data,
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

  await performBotBehavior(tx, args)

  return getItemResult(tx, { id })
}

export async function onPaidSideEffects (models, payInId) {
  const { item } = await models.itemPayIn.findUnique({
    where: { payInId },
    include: {
      item: {
        include: {
          mentions: true,
          itemReferrers: { include: { refereeItem: true } },
          user: true
        }
      }
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

export async function describe (models, payInId) {
  const { item } = await models.itemPayIn.findUnique({ where: { payInId }, include: { item: true } })
  return `SN: update ${item.parentId ? `reply #${item.id} to #${item.parentId}` : `post #${item.id}`}`
}
