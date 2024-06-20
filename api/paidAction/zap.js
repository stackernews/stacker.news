import { USER_ID } from '@/lib/constants'
import { notifyZapped } from '@/lib/webPush'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function perform ({ invoiceId, sats, id: itemId, ...args }, { me, cost, tx }) {
  const feeMsats = cost / BigInt(100)
  const zapMsats = cost - feeMsats
  itemId = parseInt(itemId)

  let invoiceData = {}
  if (invoiceId) {
    invoiceData = { invoiceId, invoiceActionState: 'PENDING' }
    // store a reference to the item in the invoice
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { actionId: itemId }
    })
  }

  const acts = await tx.itemAct.createManyAndReturn({
    data: [
      { msats: feeMsats, itemId, userId: me?.id || USER_ID.anon, act: 'FEE', ...invoiceData },
      { msats: zapMsats, itemId, userId: me?.id || USER_ID.anon, act: 'TIP', ...invoiceData }
    ]
  })

  const [{ path }] = await tx.$queryRaw`SELECT ltree2text(path) as path FROM "Item" WHERE id = ${itemId}`
  return { id: itemId, sats, act: 'TIP', path, actIds: acts.map(act => act.id) }
}

export async function retry ({ invoiceId, newInvoiceId }, { tx, cost }) {
  await tx.itemAct.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  const [{ id, path }] = await tx.$queryRaw`
    SELECT "Item".id, ltree2text(path) as path
    FROM "Item"
    JOIN "ItemAct" ON "Item".id = "ItemAct"."itemId"
    WHERE "ItemAct"."invoiceId" = ${newInvoiceId}`
  return { id, sats: Number(BigInt(cost) / BigInt(1000)), act: 'TIP', path }
}

export async function onPaid ({ invoice, actIds }, { models, tx }) {
  let acts
  if (invoice) {
    await tx.itemAct.updateMany({
      where: { invoiceId: invoice.id },
      data: {
        invoiceActionState: 'PAID'
      }
    })
    acts = await tx.itemAct.findMany({ where: { invoiceId: invoice.id }, include: { item: true } })
  } else if (actIds) {
    acts = await tx.itemAct.findMany({ where: { id: { in: actIds } }, include: { item: true } })
  } else {
    throw new Error('No invoice or actIds')
  }

  const msats = acts.reduce((a, b) => a + BigInt(b.msats), BigInt(0))
  const sats = msats / BigInt(1000)
  const itemAct = acts.find(act => act.act === 'TIP')
  const itemActFee = acts.find(act => act.act === 'FEE')

  await tx.user.update({ where: { id: itemAct.item.userId }, data: { msats: { increment: itemAct.msats } } })
  // TODO: do forwards
  // TODO: make sure these aren't read-modify-write
  // TODO: make sure these consider "invoiceActionState when computing values"
  // TODO: weighted_votes_after_tip is read-modify-write, ie successive votes from the same user will race when
  // computing the multiplier
  await tx.$executeRaw`SELECT weighted_votes_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${sats}::INTEGER)`
  // TODO: this doesn't need to be a plpgsql function
  await tx.$executeRaw`SELECT sats_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${msats}::BIGINT)`
  // TODO1: test bounties
  // might be read-modify-write in terms of adding to "bountyPaidTo"
  await tx.$executeRaw`SELECT bounty_paid_after_act(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER)`
  // TODO: this is really complicated ... forwards make it pretty intense
  await tx.$executeRaw`SELECT referral_act(${itemActFee.id}::INTEGER)`
  // TODO: check all notifications
  notifyZapped({ models, id: itemAct.itemId }).catch(console.error)
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ id: itemId, sats }, { actionId, cost }) {
  return `SN: zap ${sats ?? (cost / BigInt(1000))} sats to #${itemId ?? actionId}`
}
