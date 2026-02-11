import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { uploadFees } from '../../resolvers/upload'
import { getItemMentions, getMentions, getSubs, performBotBehavior } from '../lib/item'
import { notifyItemMention, notifyMention } from '@/lib/webPush'
import * as BOOST from './boost'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'
import { satsToMsats, msatsToSats } from '@/lib/format'
import * as MEDIA_UPLOAD from './mediaUpload'
import { getBeneficiariesMcost } from '../lib/beneficiaries'
import { getItem } from '@/api/resolvers/item'
import { subsDiff } from '@/lib/subs'
import { getTempImgproxyUrls } from '../lib/upload'
export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

async function getMcost (models, { id, boost = 0, uploadIds, bio, newSubs, parentId }, { me }) {
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

  let mcost = 0n
  const addedSubs = subsDiff(newSubs, old.subNames)
  if (!parentId && addedSubs.length > 0) {
    if (old.boost > 0) {
      throw new Error('cannot move boosted items into different territories')
    }
    for (const subName of addedSubs) {
      const sub = newSubs.find(sub => sub.name === subName)
      mcost += satsToMsats(sub.baseCost)
    }
  }

  if ((mcost > 0 || totalFeesMsats > 0 || (boost - old.boost) > 0) && old.itemPayIns.length === 0) {
    throw new Error('cannot increase item cost with unpaid invoice')
  }

  return mcost
}

export async function getInitial (models, { id, boost = 0, uploadIds, bio, subNames }, { me }) {
  const old = await models.item.findUnique({ where: { id: parseInt(id) } })
  const subs = await getSubs(models, { subNames, parentId: old.parentId })
  const mcost = await getMcost(models, { id, boost, uploadIds, bio, newSubs: subs, parentId: old.parentId }, { me })

  // for post updates, when a sub is added, it contributes to the cost
  // we populate the mcost so that the new sub gets their proportional share of the revenue
  // for reply updates, they can't change subs, so we don't populate the mcost
  const subsWithCosts = old.parentId
    ? subs
    : subs.map(sub => ({
      ...sub,
      mcost: old.subNames?.includes(sub.name) ? 0n : satsToMsats(sub.baseCost ?? 1)
    }))
  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({ subs: subsWithCosts, mcost })

  const beneficiaries = []
  if (boost - old.boost > 0) {
    beneficiaries.push(await BOOST.getInitial(models, { sats: boost - old.boost, id }, { me, subs }))
  }
  if (uploadIds.length > 0) {
    beneficiaries.push(await MEDIA_UPLOAD.getInitial(models, { uploadIds }, { me, subs }))
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
  const { id, boost = 0, uploadIds = [], options: pollOptions = [], forwardUsers: itemForwards = [], subNames = [], ...data } = args
  const payIn = await tx.payIn.findUnique({ where: { id: payInId } })

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

  const newUploadIds = difference(itemUploads, old.itemUploads, 'uploadId').map(({ uploadId }) => uploadId)
  const imgproxyUrls = await getTempImgproxyUrls(tx, newUploadIds, old.imgproxyUrls)

  // if it has changed concurrently
  // update cost if the update has a cost (e.g., moving to new territory ... or adding images)
  const additionalCost = msatsToSats(payIn.mcost)
  await tx.item.update({
    where: { id: parseInt(id) },
    data: {
      ...data,
      ...(additionalCost > 0 && { cost: { increment: additionalCost - (boost - old.boost) } }),
      imgproxyUrls,
      pollOptions: {
        createMany: {
          data: pollOptions?.map(option => ({ option }))
        }
      },
      subs: {
        create: subsDiff(subNames, old.subNames).map(subName => ({ subName })),
        deleteMany: {
          subName: {
            in: subsDiff(old.subNames, subNames)
          }
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

  // accumulate rankhot for the additional cost (excluding boost, which is handled by BOOST beneficiary)
  const costIncrease = additionalCost - (boost - old.boost)
  if (costIncrease > 0) {
    await tx.$executeRaw`
      UPDATE "Item"
      SET "hotCenteredSum" = hot_centered_sum_update("Item"."hotCenteredSum", "Item"."hotCenteredAt", ${costIncrease}::DOUBLE PRECISION),
          "hotCenteredAt" = hot_centered_at_update("Item"."hotCenteredAt")
      WHERE id = ${parseInt(id)}::INTEGER`
  }

  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, keepuntil)
    VALUES ('imgproxy', jsonb_build_object('id', ${id}::INTEGER), 21, true,
              now() + interval '5 seconds', now() + interval '1 day')`

  await performBotBehavior(tx, args)

  return await getItem(null, { id }, { models: tx, me: { id: old.userId } })
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
