import { ANON_FEE_MULTIPLIER, ANON_ITEM_SPAM_INTERVAL, ITEM_SPAM_INTERVAL, PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { notifyItemMention, notifyItemParents, notifyMention, notifyTerritorySubscribers, notifyUserSubscribers, notifyThreadSubscribers } from '@/lib/webPush'
import { getItemMentions, getMentions, performBotBehavior, getSubs } from '../lib/item'
import { msatsToSats, satsToMsats } from '@/lib/format'
import { GqlInputError } from '@/lib/error'
import * as BOOST from './boost'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'
import * as MEDIA_UPLOAD from './mediaUpload'
import { getBeneficiariesMcost } from '../lib/beneficiaries'
import { getItem } from '@/api/resolvers/item'
import { getTempImgproxyUrls } from '../lib/upload'
import { checkFreebieEligibility, incrementFreeCommentCount } from '../lib/freebie'

export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

const DEFAULT_ITEM_COST = 1000n

async function getBaseCost (models, { bio, parentId, subNames }) {
  if (bio) return DEFAULT_ITEM_COST

  const subs = await getSubs(models, { subNames, parentId })

  if (parentId) {
    let replyCost = 0n
    for (const sub of subs) {
      if (sub.replyCost) {
        replyCost += satsToMsats(sub.replyCost)
      } else {
        replyCost += DEFAULT_ITEM_COST
      }
    }
    return replyCost > 0n ? replyCost : DEFAULT_ITEM_COST
  }

  let baseCost = 0n
  for (const sub of subs) {
    if (sub.baseCost) {
      baseCost += satsToMsats(sub.baseCost)
    } else {
      baseCost += DEFAULT_ITEM_COST
    }
  }

  return baseCost > 0n ? baseCost : DEFAULT_ITEM_COST
}

async function getCost (models, { subNames, parentId, uploadIds, boost = 0, bio }, { me }) {
  const baseCost = await getBaseCost(models, { bio, parentId, subNames })

  // cost = baseCost * 10^num_items_in_10m * 100 (anon) or 1 (user) + upload fees + boost
  const [{ cost }] = await models.$queryRaw`
    SELECT ${baseCost}::INTEGER
      * POWER(10, item_spam(${parseInt(parentId)}::INTEGER, ${me.id}::INTEGER,
          ${me.id !== USER_ID.anon && !bio ? ITEM_SPAM_INTERVAL : ANON_ITEM_SPAM_INTERVAL}::INTERVAL))
      * ${me.id !== USER_ID.anon ? 1 : ANON_FEE_MULTIPLIER}::INTEGER  as cost`

  const isFreebie = await checkFreebieEligibility(models, { cost, baseCost, parentId, bio, boost }, { me })
  return isFreebie ? BigInt(0) : BigInt(cost)
}

export async function getInitial (models, args, { me }) {
  const mcost = await getCost(models, args, { me })
  const subs = await getSubs(models, args)

  // for item creation, each sub can have a different cost
  const subsWithCosts = subs.map(sub => ({
    ...sub,
    mcost: args.parentId
      ? satsToMsats(sub.replyCost ?? 1)
      : satsToMsats(sub.baseCost ?? 1)
  }))
  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({ subs: subsWithCosts, mcost })

  const beneficiaries = []
  if (args.boost > 0) {
    beneficiaries.push(
      await BOOST.getInitial(models, { sats: args.boost }, { me, subs })
    )
  }
  if (args.uploadIds?.length > 0) {
    beneficiaries.push(await MEDIA_UPLOAD.getInitial(models, { uploadIds: args.uploadIds }, { me, subs }))
  }

  return {
    payInType: 'ITEM_CREATE',
    userId: me.id,
    mcost: mcost + getBeneficiariesMcost(beneficiaries),
    payOutCustodialTokens,
    beneficiaries
  }
}

export async function onBegin (tx, payInId, args) {
  // don't want to double count boost ... it should be a beneficiary
  const { parentId, uploadIds = [], boost: _, forwardUsers = [], options: pollOptions = [], subNames = [], ...data } = args
  const payIn = await tx.payIn.findUnique({ where: { id: payInId } })

  const mentions = await getMentions(tx, { ...args, userId: payIn.userId })
  const itemMentions = await getItemMentions(tx, { ...args, userId: payIn.userId })

  // start with median vote
  if (payIn.userId !== USER_ID.anon) {
    const [row] = await tx.$queryRaw`SELECT
      COALESCE(percentile_cont(0.5) WITHIN GROUP(
        ORDER BY "weightedVotes" - "weightedDownVotes"), 0)
      AS median FROM "Item" WHERE "userId" = ${payIn.userId}::INTEGER`
    if (row?.median < 0) {
      data.weightedDownVotes = -row.median
    }
  }

  const imgproxyUrls = await getTempImgproxyUrls(tx, uploadIds)

  // freebie is true when cost is 0 and it's a comment or bio
  const isFreebie = payIn.mcost === 0n && !!(parentId || data.bio)

  const itemData = {
    parentId: parentId ? parseInt(parentId) : null,
    ...data,
    cost: msatsToSats(payIn.mcost),
    freebie: isFreebie,
    imgproxyUrls,
    itemPayIns: {
      create: [{ payInId }]
    },
    subs: {
      createMany: {
        data: subNames.map(subName => ({ subName }))
      }
    },
    threadSubscriptions: {
      createMany: {
        data: [
          { userId: data.userId },
          ...forwardUsers.map(({ userId }) => ({ userId }))
        ]
      }
    },
    itemForwards: {
      createMany: {
        data: forwardUsers
      }
    },
    pollOptions: {
      createMany: {
        data: pollOptions.map(option => ({ option }))
      }
    },
    itemUploads: {
      create: uploadIds.map(id => ({ uploadId: id }))
    },
    mentions: {
      createMany: {
        data: mentions
      }
    },
    itemReferrers: {
      create: itemMentions
    }
  }

  let item
  if (data.bio && payIn.userId !== USER_ID.anon) {
    item = (await tx.user.update({
      where: { id: data.userId },
      include: { bio: true },
      data: {
        bio: {
          create: itemData
        }
      }
    })).bio
  } else {
    try {
      item = await tx.item.create({ data: itemData })
    } catch (err) {
      if (err.message.includes('violates exclusion constraint \\"Item_unique_time_constraint\\"')) {
        const message = `you already submitted this ${itemData.title ? 'post' : 'comment'}`
        throw new GqlInputError(message)
      }
      throw err
    }
  }

  await performBotBehavior(tx, { ...item, userId: payIn.userId })

  return await getItem(null, { id: item.id }, { models: tx, me: { id: payIn.userId } })
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  const itemPayIn = await tx.itemPayIn.findUnique({ where: { payInId: oldPayInId }, include: { payIn: true } })
  return await getItem(null, { id: itemPayIn.itemId }, { models: tx, me: { id: itemPayIn.payIn.userId } })
}

export async function onPaid (tx, payInId) {
  const { item, payIn } = await tx.itemPayIn.findUnique({
    where: { payInId },
    include: { item: true, payIn: true }
  })
  if (!item) {
    throw new Error('Item not found')
  }

  // If this is a freebie comment, increment the free comment counter
  await incrementFreeCommentCount(tx, { item, userId: payIn.userId })

  await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
    VALUES ('timestampItem', jsonb_build_object('id', ${item.id}::INTEGER), now() + interval '10 minutes', -2)`
  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', ${item.id}::INTEGER), 21, true, now() + interval '5 seconds')`

  if (item.parentId) {
    // denormalize ncomments, lastCommentAt for ancestors, and insert into reply table
    await tx.$executeRaw`
      WITH comment AS (
        SELECT "Item".*
        FROM "Item"
        JOIN users ON "Item"."userId" = users.id
        WHERE "Item".id = ${item.id}::INTEGER
      ), ancestors AS (
        SELECT "Item".*
        FROM "Item", comment
        WHERE "Item".path @> comment.path AND "Item".id <> comment.id
        ORDER BY "Item".id
      ), updated_ancestors AS (
        UPDATE "Item"
        SET ncomments = "Item".ncomments + 1,
          "lastCommentAt" = GREATEST("Item"."lastCommentAt", comment.created_at),
          "nDirectComments" = "Item"."nDirectComments" +
            CASE WHEN comment."parentId" = "Item".id THEN 1 ELSE 0 END
        FROM comment, ancestors
        WHERE "Item".id = ancestors.id
        RETURNING "Item".*
      )
      INSERT INTO "Reply" (created_at, updated_at, "ancestorId", "ancestorUserId", "itemId", "userId", level)
        SELECT comment.created_at, comment.updated_at, ancestors.id, ancestors."userId",
          comment.id, comment."userId", nlevel(comment.path) - nlevel(ancestors.path)
        FROM ancestors, comment`
  }
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

  if (item.parentId) {
    notifyItemParents({ item, models }).catch(console.error)
    notifyThreadSubscribers({ models, item }).catch(console.error)
  }
  for (const { userId } of item.mentions) {
    notifyMention({ models, item, userId }).catch(console.error)
  }
  for (const { refereeItem } of item.itemReferrers) {
    notifyItemMention({ models, referrerItem: item, refereeItem }).catch(console.error)
  }

  notifyUserSubscribers({ models, item }).catch(console.error)
  notifyTerritorySubscribers({ models, item }).catch(console.error)
}

export async function describe (models, payInId) {
  const itemPayIn = await models.itemPayIn.findUnique({ where: { payInId }, include: { item: true } })
  if (itemPayIn?.item) {
    return `SN: create ${itemPayIn.item.parentId ? `reply #${itemPayIn.item.id} to #${itemPayIn.item.parentId}` : `post #${itemPayIn.item.id}`}`
  }
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { pessimisticEnv: true } })
  if (payIn.pessimisticEnv?.args) {
    const { subNames, parentId, bio } = payIn.pessimisticEnv.args
    if (bio) {
      return 'SN: create bio'
    }
    if (parentId) {
      return `SN: create reply to #${parentId}`
    }
    return `SN: create post in ${subNames.join(', ')}`
  }
  return 'SN: create item'
}
