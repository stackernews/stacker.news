export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ id }, { me, models }) {
  const item = await models.poll.findUnique({ where: { id } })
  return BigInt(item.pollCost) * BigInt(1000)
}

export async function perform ({ invoiceId, optionId, id: itemId, ...args }, { me, cost, tx }) {
  let invoiceData = {}
  if (invoiceId) {
    invoiceData = { invoiceId, invoiceActionState: 'PENDING' }
  }

  await tx.itemAct.create({ data: { msats: cost, itemId, userId: me.id, act: 'POLL', ...invoiceData } })
  await tx.pollVote.create({ data: { optionId, userId: me.id, itemId, ...invoiceData } })

  return itemId
}

export async function onPaid ({ invoice }, { tx }) {
  if (!invoice) return

  await tx.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  await tx.pollVote.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.pollVote.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ id }, context) {
  return `SN: vote on poll #${id}`
}
