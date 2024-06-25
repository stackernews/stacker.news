import { ANON_ITEM_SPAM_INTERVAL, ITEM_SPAM_INTERVAL, USER_ID } from '@/lib/constants'
import { notifyItemMention, notifyItemParents, notifyMention, notifyTerritorySubscribers, notifyUserSubscribers } from '@/lib/webPush'
import { getItemMentions, getMentions, performBotBehavior } from './lib/item'
import { satsToMsats } from '@/lib/format'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ subName, parentId, uploadIds, boost = 0, bio }, { models, user }) {
  const sub = parentId || bio ? null : await models.sub.findUnique({ where: { name: subName } })
  const baseCost = sub ? satsToMsats(sub.baseCost) : 1000n

  // cost = baseCost * 10^num_items_in_10m * 100 (anon) or 1 (user) + image fees + boost
  const [{ cost }] = await models.$queryRaw`
    SELECT ${baseCost}::INTEGER
      * POWER(10, item_spam(${parseInt(parentId)}::INTEGER, ${user?.id || USER_ID.anon}::INTEGER,
          ${user?.id && !bio ? ITEM_SPAM_INTERVAL : ANON_ITEM_SPAM_INTERVAL}::INTERVAL))
      * ${user ? 1 : 100}::INTEGER
      + (SELECT "nUnpaid" * "imageFeeMsats"
          FROM image_fees_info(${user?.id || USER_ID.anon}::INTEGER, ${uploadIds}))
      + ${satsToMsats(boost)}::INTEGER as cost`

  // sub allows freebies (or is a bio or a comment), cost is less than baseCost, not anon, and cost must be greater than user's balance
  const freebie = (parentId || bio || sub?.allowFreebies) && cost <= baseCost && !!user && cost > user?.msats

  return freebie ? BigInt(0) : BigInt(cost)
}

export async function perform (args, context) {
  const { invoiceId, parentId, uploadIds = [], forwardUsers = [], options: pollOptions = [], boost = 0, ...data } = args
  const { tx, me, cost } = context
  const boostMsats = satsToMsats(boost)

  let invoiceData = {}
  if (invoiceId) {
    invoiceData = { invoiceId, invoiceActionState: 'PENDING' }
    await tx.upload.updateMany({
      where: { id: { in: uploadIds } },
      data: invoiceData
    })
  }

  const itemActs = []
  if (boostMsats > 0) {
    itemActs.push({
      msats: boostMsats, act: 'BOOST', userId: data.userId, ...invoiceData
    })
  }
  if (cost > 0) {
    itemActs.push({
      msats: cost - boostMsats, act: 'FEE', userId: data.userId, ...invoiceData
    })
  } else {
    data.freebie = true
  }

  const mentions = await getMentions(args, context)
  const itemMentions = await getItemMentions(args, context)

  // start with median vote
  if (me) {
    const [row] = await tx.$queryRaw`SELECT
      COALESCE(percentile_cont(0.5) WITHIN GROUP(
        ORDER BY "weightedVotes" - "weightedDownVotes"), 0)
      AS median FROM "Item" WHERE "userId" = ${me.id}`
    if (row?.median < 0) {
      data.weightedDownVotes = -row.median
    }
  }

  const itemData = {
    parentId: parentId ? parseInt(parentId) : null,
    ...data,
    ...invoiceData,
    boost,
    // TODO: test all these nested inserts
    // TODO: give nested relations a consistent naming scheme
    ThreadSubscription: {
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
    PollOption: {
      createMany: {
        data: pollOptions.map(option => ({ option }))
      }
    },
    ItemUpload: {
      connect: uploadIds.map(id => ({ uploadId: id }))
    },
    actions: {
      createMany: {
        data: itemActs
      }
    },
    mentions: {
      createMany: {
        data: mentions
      }
    },
    referrer: {
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
    item = await tx.item.create({ data: itemData })
  }

  // store a reference to the item in the invoice
  if (invoiceId) {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { actionId: item.id }
    })
  }

  await performBotBehavior(item, context)

  // ltree is unsupported in Prisma, so we have to query it manually (FUCK!)
  return (await tx.$queryRaw`
    SELECT *, ltree2text(path) AS path, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM "Item" WHERE id = ${item.id}`
  )[0]
}

export async function retry ({ invoiceId, newInvoiceId }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  await tx.item.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  await tx.upload.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  return (await tx.$queryRaw`
    SELECT *, ltree2text(path) AS path, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM "Item" WHERE "invoiceId" = ${newInvoiceId}`
  )[0]
}

export async function onPaid ({ invoice, id }, context) {
  const { models, tx } = context
  let item

  if (invoice) {
    item = await tx.item.findFirst({
      where: { invoiceId: invoice.id },
      include: {
        mentions: true,
        referrer: { include: { refereeItem: true } },
        user: true
      }
    })
    await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
    await tx.item.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID', invoicePaidAt: new Date() } })
    await tx.upload.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID', paid: true } })
  } else if (id) {
    item = await tx.item.findUnique({
      where: { id },
      include: {
        mentions: true,
        referrer: { include: { refereeItem: true } },
        user: true
      }
    })
  } else {
    throw new Error('No item found')
  }

  await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
    VALUES ('timestampItem', jsonb_build_object('id', ${item.id}), now() + interval '10 minutes', -2)`
  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', ${item.id}), 21, true, now() + interval '5 seconds')`

  // TODO: referals for boost

  if (item.parentId) {
    // denormalize ncomments and "weightedComments" for ancestors, and insert into reply table
    await tx.$executeRaw`
      WITH comment AS (
        SELECT *
        FROM "Item"
        WHERE id = ${item.id}
      ), ancestors AS (
        UPDATE "Item"
        SET ncomments = "Item".ncomments + 1,
          "weightedComments" = "Item"."weightedComments" +
            CASE WHEN comment."userId" = "Item"."userId" THEN 0 ELSE ${item.user.trust} END
        FROM comment
        WHERE "Item".path @> comment.path AND "Item".id <> comment.id
        RETURNING "Item".*
      )
      INSERT INTO "Reply" (created_at, updated_at, "ancestorId", "ancestorUserId", "itemId", "userId", level)
        SELECT comment.created_at, comment.updated_at, ancestors.id, ancestors."userId",
          comment.id, comment."userId", nlevel(comment.path) - nlevel(ancestors.path)
        FROM ancestors, comment
        WHERE ancestors."userId" <> comment."userId"`

    notifyItemParents({ item, me: item.userId, models }).catch(console.error)
  }

  for (const { userId } of item.mentions) {
    notifyMention({ models, item, userId }).catch(console.error)
  }
  for (const { referee } of item.referrer) {
    notifyItemMention({ models, referrerItem: item, refereeItem: referee }).catch(console.error)
  }
  notifyUserSubscribers({ models, item }).catch(console.error)
  notifyTerritorySubscribers({ models, item }).catch(console.error)
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.item.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.upload.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ parentId }, context) {
  return `SN: create ${parentId ? `reply to #${parentId}` : 'item'}`
}
