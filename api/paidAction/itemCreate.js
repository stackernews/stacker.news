import { ANON_USER_ID } from '@/lib/constants'
import { notifyItemParents, notifyTerritorySubscribers, notifyUserSubscribers } from '@/lib/webPush'
import { getMentions, performBotBehavior } from './lib/item'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ subName, parentId, uploadIds, boost }, { models, user }) {
  const sub = parentId ? null : await models.sub.findUnique({ where: { name: subName } })
  const baseCost = parentId ? BigInt(1000) : BigInt(sub.baseCost) * BigInt(1000)
  // baseCost * 10^num_items_in_10m * 100 (anon) or 1 (user) + image fees
  const [{ cost }] = await models.$queryRaw`
    SELECT ${baseCost}::INTEGER
      * POWER(10, item_spam(${parentId}::INTEGER, ${user?.id || ANON_USER_ID}::INTEGER, '10m'::INTERVAL))
      * ${user ? 1 : 100}::INTEGER
      + (SELECT "nUnpaid" * "imageFeeMsats" FROM image_fees_info(${user?.id || ANON_USER_ID}::INTEGER, ${uploadIds})) as cost`
  // freebies must be allowed, cost must be less than baseCost, no boost, user must exist, and cost must be less or equal to user's balance
  const freebie = (parentId || sub?.allowFreebies) && cost <= baseCost && !boost && !!user && cost > user?.msats
  return freebie ? BigInt(0) : BigInt(cost)
}

export async function perform (args, context) {
  const { invoiceId, parentId, uploadIds = [], forwardUsers = [], pollOptions = [], boost = 0, ...data } = args
  const { tx, me, cost } = context
  const boostMsats = BigInt(boost) * BigInt(1000)

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
        data: pollOptions
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
    }
  }

  // TODO: test bio
  if (data.bio && me) {
    return (await tx.user.update({
      where: { id: data.userId },
      data: {
        bio: {
          create: itemData
        }
      }
    })).bio
  }

  const { id } = await tx.item.create({ data: itemData })

  // ltree is unsupported in Prisma, so we have to query it manually (FUCK!)
  return (await tx.$queryRaw`
    SELECT *, ltree2text(path) AS path, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM "Item" WHERE id = ${id}`
  )[0]
}

export async function onPaid ({ invoice, id }, context) {
  const { models, tx } = context
  let item

  if (invoice) {
    item = await tx.item.findFirst({ where: { invoiceId: invoice.id } })
    await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
    await tx.item.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
    await tx.upload.updateMany({ where: { invoiceId: invoice.id }, data: { actionInvoiceState: 'PAID', paid: true } })
  } else if (id) {
    item = await tx.item.findUnique({ where: { id } })
  } else {
    throw new Error('No item found')
  }

  await performBotBehavior(item, context)

  if (item.maxBid) {
    await tx.$executeRaw`SELECT run_auction(${item.id}::INTEGER)`
  }

  await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
    VALUES ('timestampItem', jsonb_build_object('id', ${item.id}), now() + interval '10 minutes', -2)`
  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', ${item.id}), 21, true, now() + interval '5 seconds')`

  if (item.parentId) {
    await tx.$executeRaw`SELECT ncomments_after_comment(${item.id}::INTEGER)`
    notifyItemParents({ item, me: item.userId, models }).catch(console.error)
  }
  notifyUserSubscribers({ models, item }).catch(console.error)
  notifyTerritorySubscribers({ models, item }).catch(console.error)
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.item.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.upload.updateMany({ where: { invoiceId: invoice.id }, data: { actionInvoiceState: 'FAILED' } })
}

export async function describe ({ parentId }, context) {
  return `SN: create ${parentId ? `reply to #${parentId}` : 'post'}`
}
