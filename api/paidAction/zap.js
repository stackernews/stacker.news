import { notifyZapped } from '@/lib/webPush'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function perform ({ invoiceId, sats, itemId, ...args }, { me, cost, tx }) {
  const feeMsats = cost / BigInt(100)
  const zapMsats = cost - feeMsats

  await tx.itemAct.createMany({
    data: [
      { msats: feeMsats, itemId, userId: me.id, act: 'FEE', invoiceId, invoiceActionState: 'PENDING' },
      { msats: zapMsats, itemId, userId: me.id, act: 'TIP', invoiceId, invoiceActionState: 'PENDING' }
    ]
  })

  const item = await tx.item.findUnique({ where: { id: itemId } })
  return { id: itemId, sats, act: 'TIP', path: item.path }
}

export async function onPaid ({ invoice }, { models, tx }) {
  const acts = await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  const sats = acts.reduce((a, b) => a + b, 0) / BigInt(1000)
  const itemAct = acts.find(act => act.act === 'TIP')
  const itemActFee = acts.find(act => act.act === 'FEE')

  // TODO: do forwards
  await tx.user.update({ where: { id: itemAct.item.userId }, data: { msats: { increment: itemAct.msats } } })
  await tx.$executeRaw(`SELECT weighted_votes_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${sats}::BIGINT)`)
  await tx.$executeRaw(`SELECT sats_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${sats}::BIGINT)`)
  await tx.$executeRaw(`SELECT bounty_paid(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER)`)
  await tx.$executeRaw(`SELECT referral_act(${itemActFee.id}::INTEGER)`)
  notifyZapped({ models, id: itemAct.itemId }).catch(console.error)
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ itemId, sats }) {
  return `SN: zap ${sats} sats to #${itemId}`
}
