import { ANON_ITEM_SPAM_INTERVAL, ITEM_SPAM_INTERVAL, PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { notifyItemMention, notifyItemParents, notifyMention, notifyTerritorySubscribers, notifyUserSubscribers, notifyThreadSubscribers } from '@/lib/webPush'
import { getItemMentions, getMentions, performBotBehavior } from '../lib/item'
import { satsToMsats } from '@/lib/format'
import { GqlInputError } from '@/lib/error'
import * as BOOST from './boost'

export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

const DEFAULT_ITEM_COST = 1000n

async function getBaseCost (models, { bio, parentId, subName }) {
  if (bio) return DEFAULT_ITEM_COST

  if (parentId) {
    // the subname is stored in the root item of the thread
    const [sub] = await models.$queryRaw`
      SELECT s."replyCost"
      FROM "Item" i
      LEFT JOIN "Item" r ON r.id = i."rootId"
      LEFT JOIN "Sub" s ON s.name = COALESCE(r."subName", i."subName")
      WHERE i.id = ${Number(parentId)}`

    if (sub?.replyCost) return satsToMsats(sub.replyCost)
    return DEFAULT_ITEM_COST
  }

  const sub = await models.sub.findUnique({ where: { name: subName } })
  return satsToMsats(sub.baseCost)
}

async function getCost (models, { subName, parentId, uploadIds, boost = 0, bio }, { me }) {
  const baseCost = await getBaseCost(models, { bio, parentId, subName })

  // cost = baseCost * 10^num_items_in_10m * 100 (anon) or 1 (user) + upload fees + boost
  const [{ cost }] = await models.$queryRaw`
    SELECT ${baseCost}::INTEGER
      * POWER(10, item_spam(${parseInt(parentId)}::INTEGER, ${me?.id ?? USER_ID.anon}::INTEGER,
          ${me?.id && !bio ? ITEM_SPAM_INTERVAL : ANON_ITEM_SPAM_INTERVAL}::INTERVAL))
      * ${me ? 1 : 100}::INTEGER
      + (SELECT "nUnpaid" * "uploadFeesMsats"
          FROM upload_fees(${me?.id || USER_ID.anon}::INTEGER, ${uploadIds}::INTEGER[])) as cost`

  // sub allows freebies (or is a bio or a comment), cost is less than baseCost, not anon,
  // cost must be greater than user's balance, and user has not disabled freebies
  const freebie = (parentId || bio) && cost <= baseCost && !!me &&
    me?.msats < cost && !me?.disableFreebies && me?.mcredits < cost && boost <= 0

  return freebie ? BigInt(0) : BigInt(cost)
}

export async function getInitial (models, args, { me }) {
  const mcost = await getCost(models, args, { me })
  const sub = await models.sub.findUnique({ where: { name: args.subName } })
  const revenueMsats = mcost * BigInt(sub.rewardsPct) / 100n
  const rewardMsats = mcost - revenueMsats

  let beneficiaries
  if (args.boost > 0) {
    beneficiaries = [
      await BOOST.getInitial(models, { sats: args.boost, sub }, { me })
    ]
  }
  return {
    payInType: 'ITEM_CREATE',
    userId: me?.id,
    mcost,
    payOutCustodialTokens: [
      {
        payOutType: 'TERRITORY_REVENUE',
        userId: sub.userId,
        mtokens: revenueMsats,
        custodialTokenType: 'SATS',
        subPayOutCustodialToken: {
          subName: sub.name
        }
      },
      { payOutType: 'REWARD_POOL', userId: null, mtokens: rewardMsats, custodialTokenType: 'SATS' }
    ],
    beneficiaries
  }
}

// TODO: uploads should just have an itemId
export async function onBegin (tx, payInId, args, { me }) {
  const { invoiceId, parentId, uploadIds = [], forwardUsers = [], options: pollOptions = [], boost = 0, ...data } = args

  const deletedUploads = []
  for (const uploadId of uploadIds) {
    if (!await tx.upload.findUnique({ where: { id: uploadId } })) {
      deletedUploads.push(uploadId)
    }
  }
  if (deletedUploads.length > 0) {
    throw new Error(`upload(s) ${deletedUploads.join(', ')} are expired, consider reuploading.`)
  }

  const mentions = await getMentions(tx, args, { me })
  const itemMentions = await getItemMentions(tx, args, { me })

  // start with median vote
  if (me !== USER_ID.anon) {
    const [row] = await tx.$queryRaw`SELECT
      COALESCE(percentile_cont(0.5) WITHIN GROUP(
        ORDER BY "weightedVotes" - "weightedDownVotes"), 0)
      AS median FROM "Item" WHERE "userId" = ${me.id}::INTEGER`
    if (row?.median < 0) {
      data.weightedDownVotes = -row.median
    }
  }

  const itemData = {
    parentId: parentId ? parseInt(parentId) : null,
    ...data,
    itemPayIn: {
      create: {
        payInId
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
  if (data.bio && me) {
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

  await performBotBehavior(tx, item, { me })

  const { beneficiaries } = await tx.payIn.findUnique({ where: { id: payInId }, include: { beneficiaries: true } })
  for (const beneficiary of beneficiaries) {
    await BOOST.onBegin(tx, beneficiary.id, { sats: boost, id: item.id }, { me })
  }
}

// TODO: caller of onRetry needs to update beneficiaries
export async function onRetry (tx, oldPayInId, newPayInId) {
  await tx.itemPayIn.updateMany({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
}

export async function onPaid (tx, payInId) {
  const { item } = await tx.itemPayIn.findUnique({ where: { payInId }, include: { item: true } })
  if (!item) {
    throw new Error('Item not found')
  }

  await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
    VALUES ('timestampItem', jsonb_build_object('id', ${item.id}::INTEGER), now() + interval '10 minutes', -2)`
  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', ${item.id}::INTEGER), 21, true, now() + interval '5 seconds')`

  if (item.parentId) {
    // denormalize ncomments, lastCommentAt for ancestors, and insert into reply table
    await tx.$executeRaw`
      WITH comment AS (
        SELECT "Item".*, users.trust
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

export async function onPaidSideEffects (models, payInId, { me }) {
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

  const { beneficiaries } = await models.payIn.findUnique({ where: { id: payInId }, include: { beneficiaries: true } })
  for (const beneficiary of beneficiaries) {
    await BOOST.onPaidSideEffects(models, beneficiary.id)
  }
}

export async function describe (models, payInId, { me }) {
  const item = await models.item.findUnique({ where: { payInId } })
  return `SN: create ${item.parentId ? `reply to #${item.parentId}` : 'item'}`
}
