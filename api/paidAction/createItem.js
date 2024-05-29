import { ANON_USER_ID } from '@/lib/constants'
import { getDeleteAt, getRemindAt } from '@/lib/item'
import { notifyItemParents, notifyTerritorySubscribers, notifyUserSubscribers } from '@/lib/webPush'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ subName, parentId, uploadIds, boost }, { models, user }) {
  const sub = await models.sub.findUnique({ where: { name: subName } })
  const baseCost = sub.baseCost * BigInt(1000)
  // baseCost * 10^num_items_in_10m * 100 (anon) or 1 (user) + image fees
  const [cost] = await models.$queryRaw`
    SELECT ${baseCost}::INTEGER
      * POWER(10, item_spam(${parentId}::INTEGER, ${user?.id || ANON_USER_ID}::INTEGER, '10m'::INTERVAL))
      * ${user ? 1 : 100}::INTEGER
      + (SELECT "nUnpaid" * "imageFeeMsats" FROM image_fees_info(${user?.id || ANON_USER_ID}::INTEGER, ${uploadIds}))`
  // freebies must be allowed, cost must be less than baseCost, no boost, user must exist, and cost must be less or equal to user's balance
  const freebie = sub.allowFreebies && cost <= baseCost && !boost && !!user && cost <= user?.privates?.msats
  return freebie ? 0 : cost
}

export async function doStatements (
  { invoiceId, uploadIds = [], itemForwards = [], pollOptions = [], boost = 0, ...data },
  { me, models, cost }) {
  const boostMsats = BigInt(boost) * BigInt(1000)

  const itemActs = []
  if (boostMsats > 0) {
    itemActs.push({
      msats: boostMsats, act: 'BOOST', invoiceId, invoiceActionState: 'PENDING', userId: me.id
    })
  }
  if (cost > 0) {
    itemActs.push({
      msats: cost - boostMsats, act: 'FEE', invoiceId, invoiceActionState: 'PENDING', userId: me.id
    })
  } else {
    data.freebie = true
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

  const itemData = {
    ...data,
    boost,
    invoiceId,
    userId: me.id || ANON_USER_ID,
    actionInvoiceState: 'PENDING',
    threadSubscription: {
      createMany: [
        { userId: me.id },
        ...itemForwards.map(({ userId }) => ({ userId }))
      ]
    },
    itemForwards: {
      createMany: itemForwards
    },
    pollOptions: {
      createMany: pollOptions
    },
    itemUploads: {
      connect: uploadIds.map(id => ({ uploadId: id }))
    },
    itemAct: {
      createMany: itemActs
    },
    mention: {
      createMany: mentions
    }
  }

  const stmts = []
  if (data.bio && me) {
    stmts.push(models.user.update({
      where: { id: me.id },
      data: {
        bio: {
          create: itemData
        }
      }
    }))
  } else {
    stmts.push(models.item.create({
      data: itemData
    }))
  }

  return [
    ...stmts,
    models.upload.updateMany({
      where: { id: { in: uploadIds } },
      data: { invoiceId, actionInvoiceState: 'PENDING' }
    })
  ]
}

export async function resultsToResponse (results, args, context) {
  return args.bio ? results[0].bio : results[0]
}

export async function onPaidStatements ({ invoice }, { models }) {
  const item = await models.item.findFirst({ where: { invoiceId: invoice.id } })

  const stmts = []
  if (item.deleteAt) {
    stmts.push(models.$queryRaw`
      INSERT INTO pgboss.job (name, data, startafter, expirein)
      VALUES (
        'deleteItem',
        jsonb_build_object('id', ${item.id}),
        ${item.deleteAt},
        ${item.deleteAt} - now() + interval '1 minute')`)
  }
  if (item.remindAt) {
    stmts.push(models.$queryRaw`
      INSERT INTO pgboss.job (name, data, startafter, expirein)
      VALUES (
        'remindItem',
        jsonb_build_object('id', ${item.id}),
        ${item.remindAt},
        ${item.remindAt} - now() + interval '1 minute')`)
  }
  if (item.maxBid) {
    stmts.push(models.$executeRaw`SELECT run_auction(${item.id}::INTEGER)`)
  }

  return [
    models.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.item.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.upload.updateMany({ where: { invoiceId: invoice.id }, data: { actionInvoiceState: 'PAID' } }),
    // TODO: this don't work because it's a trigger
    models.$executeRaw`SELECT ncomments_after_comment(${item.id}::INTEGER)`,
    // jobs ... TODO: remove the triggers for these
    models.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
      VALUES ('timestampItem', jsonb_build_object('id', ${item.id}), now() + interval '10 minutes', -2)`,
    models.$executeRaw`INSERT INTO pgboss.job (name, data, priority) VALUES ('indexItem', jsonb_build_object('id', ${item.id}), -100)`,
    models.$executeRaw`
      INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
      VALUES ('imgproxy', jsonb_build_object('id', item.id), 21, true, now() + interval '5 seconds')`,
    ...stmts,
    // TODO: this doesn't work because we expect prisma queries
    notifyItemParents({ item, me: item.userId, models }),
    notifyUserSubscribers({ models, item }),
    notifyTerritorySubscribers({ models, item })
  ]
}

export async function onFailedStatements ({ invoice }, { models }) {
  return [
    models.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } }),
    models.item.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } }),
    models.upload.updateMany({ where: { invoiceId: invoice.id }, data: { actionInvoiceState: 'FAILED' } })
  ]
}

export async function describe ({ parentId }, context) {
  return `SN: create ${parentId ? `reply to #${parentId}` : 'post'}`
}
