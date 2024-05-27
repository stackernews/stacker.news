export const anonable = true
export const peer2peerable = true
export const supportsPessimism = false
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function shouldDoPeer2Peer ({ sats, ...args }, { me }) {
  // do peer2peer if the payer does not have enough credits
  // and the zap would send the payee beyond their max balance
  return true
}

export async function performStatements ({ invoiceId, sats, itemId, ...args }, { me, models }) {
  const msats = BigInt(sats) * BigInt(1000)
  const feeMsats = msats / BigInt(100)
  const zapMsats = msats - feeMsats

  return [models.itemAct.createMany({
    data: [
      { msats: feeMsats, itemId, userId: me.id, act: 'FEE', invoiceId, invoiceActionState: 'PENDING' },
      { msats: zapMsats, itemId, userId: me.id, act: 'TIP', invoiceId, invoiceActionState: 'PENDING' }
    ]
  })]
}

export async function onPaidStatements ({ invoice }, { models }) {
  // mark all itemActs as PAID
  // perform weighted votes
  // perform sats after tip
  // perform bounty paid
  // forwards?
  // referrals?
  const [itemAct] = await models.itemAct.findFirst({
    where: {
      invoiceId: invoice.id,
      act: 'TIP',
      invoiceActionState: 'PENDING'
    }
  })

  return [
    models.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.$executeRaw(`SELECT weighted_votes_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${invoice.receivedMsats}::BIGINT)`),
    models.$executeRaw(`SELECT sats_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${invoice.receivedMsats}::BIGINT)`),
    models.$executeRaw(`SELECT bounty_paid(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER)`)
  ]
}
