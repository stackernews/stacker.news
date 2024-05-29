import { notifyZapped } from '@/lib/webPush'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function doStatements ({ invoiceId, sats, itemId, ...args }, { me, cost, models }) {
  const feeMsats = cost / BigInt(100)
  const zapMsats = cost - feeMsats

  return [models.itemAct.createMany({
    data: [
      { msats: feeMsats, itemId, userId: me.id, act: 'FEE', invoiceId, invoiceActionState: 'PENDING' },
      { msats: zapMsats, itemId, userId: me.id, act: 'TIP', invoiceId, invoiceActionState: 'PENDING' }
    ]
  })]
}

export async function onPaidStatements ({ invoice }, { models }) {
  const itemAct = await models.itemAct.findFirst({
    where: {
      invoiceId: invoice.id,
      act: 'TIP',
      invoiceActionState: 'PENDING'
    },
    include: { item: true }
  })
  const itemActFee = await models.itemAct.findFirst({
    where: {
      invoiceId: invoice.id,
      act: 'FEE',
      invoiceActionState: 'PENDING'
    },
    include: { item: true }
  })

  const sats = (itemAct.msats + itemActFee.msats) / BigInt(1000)

  return [
    models.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    // TODO: do forwards
    models.user.update({ where: { id: itemAct.item.userId }, data: { msats: { increment: itemAct.msats } } }),
    models.$executeRaw(`SELECT weighted_votes_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${sats}::BIGINT)`),
    models.$executeRaw(`SELECT sats_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${sats}::BIGINT)`),
    models.$executeRaw(`SELECT bounty_paid(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER)`),
    models.$executeRaw(`SELECT referral_act(${itemActFee.id}::INTEGER)`),
    // TODO: not a prisma query
    notifyZapped({ models, id: itemAct.itemId })
  ]
}

export async function resultsToResponse (results, { id, sats, act }, { models }) {
  const item = await models.item.findUnique({ where: { id } })
  return {
    id,
    sats,
    act,
    path: item.path
  }
}

export async function describe ({ itemId, sats }, context) {
  return `SN: zap ${sats} sats to #${itemId}`
}
