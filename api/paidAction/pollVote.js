export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ id }, { me, models }) {
  const item = await models.poll.findUnique({ where: { id } })
  return BigInt(item.pollCost) * BigInt(1000)
}

export async function doStatements ({ invoiceId, optionId, id: itemId, ...args }, { me, cost, models }) {
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

export async function resultsToResponse (results, { id }, context) {
  return id
}

export async function describe ({ id }, context) {
  return `SN: vote on poll #${id}`
}
