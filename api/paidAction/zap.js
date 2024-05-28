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
  // mark all itemActs as PAID
  // send money to recipients
  // perform weighted votes
  // perform sats after tip
  // perform bounty paid
  // job stuff
  // notifications
  const [itemAct] = await models.itemAct.findFirst({
    where: {
      invoiceId: invoice.id,
      act: 'TIP',
      invoiceActionState: 'PENDING'
    }
  })

  return [
    models.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    // TODO: assumes sats are in msats (should probably get this from the itemAct query instead of the invoice record)
    models.$executeRaw(`SELECT weighted_votes_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${invoice.receivedMsats}::BIGINT)`),
    models.$executeRaw(`SELECT sats_after_tip(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${invoice.receivedMsats}::BIGINT)`),
    // TODO: not sure if we can call bounty paid if not a bounty
    models.$executeRaw(`SELECT bounty_paid(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER)`)
  ]
}

export async function resultsToResponse (results, args, context) {
  // TODO
  return null
}

export async function describe ({ itemId, sats }, context) {
  return `SN: zap ${sats} sats to #${itemId}`
}
