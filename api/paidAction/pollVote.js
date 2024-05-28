export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost () {
  return 1000n
}

export async function doStatements ({ invoiceId, optionId, itemId, ...args }, { me, cost, models }) {
  return [
    models.itemAct.create({ data: { msats: cost, itemId, userId: me.id, act: 'POLL', invoiceId, invoiceActionState: 'PENDING' } }),
    models.pollVote.create({ data: { optionId, userId: me.id, itemId, invoiceId, invoiceActionState: 'PENDING' } })
  ]
}

export async function onPaidStatements ({ invoice }, { models }) {
  return [
    models.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.pollVote.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  ]
}

export async function resultsToResponse (results, args, context) {
  // TODO
  return null
}

export async function describe ({ itemId }, context) {
  return `SN: vote on poll #${itemId}`
}
