export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ id }, { me, models }) {
  const pollOption = await models.pollOption.findUnique({
    where: { id: parseInt(id) },
    include: { item: true }
  })
  return BigInt(pollOption.item.pollCost) * BigInt(1000)
}

export async function perform ({ invoiceId, id }, { me, cost, tx }) {
  const pollOption = await tx.pollOption.findUnique({
    where: { id: parseInt(id) }
  })
  const itemId = parseInt(pollOption.itemId)

  let invoiceData = {}
  if (invoiceId) {
    invoiceData = { invoiceId, invoiceActionState: 'PENDING' }
  }

  // the unique index on userId, itemId will prevent double voting
  await tx.itemAct.create({ data: { msats: cost, itemId, userId: me.id, act: 'POLL', ...invoiceData } })
  await tx.pollBlindVote.create({ data: { userId: me.id, itemId, ...invoiceData } })
  await tx.pollVote.create({ data: { pollOptionId: pollOption.id, itemId, ...invoiceData } })

  return { id }
}

export async function retry ({ invoiceId, newInvoiceId }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  await tx.pollBlindVote.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  await tx.pollVote.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
}

export async function onPaid ({ invoice }, { tx }) {
  if (!invoice) return

  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  await tx.pollBlindVote.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  await tx.pollVote.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.pollBlindVote.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.pollVote.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ id }, context) {
  return `SN: vote on poll #${id}`
}
