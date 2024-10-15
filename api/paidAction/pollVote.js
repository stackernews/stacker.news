import { satsToMsats } from '@/lib/format'

export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ id }, { me, models }) {
  const pollOption = await models.pollOption.findUnique({
    where: { id: parseInt(id) },
    include: { item: true }
  })
  return satsToMsats(pollOption.item.pollCost)
}

export async function perform ({ invoiceId, id }, { me, cost, tx }) {
  const pollOption = await tx.pollOption.findUnique({
    where: { id: parseInt(id) }
  })
  const itemId = parseInt(pollOption.itemId)

  let invoiceData = {}
  if (invoiceId) {
    invoiceData = { invoiceId, invoiceActionState: 'PENDING' }
    // store a reference to the item in the invoice
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { actionId: itemId }
    })
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

  const { pollOptionId } = await tx.pollVote.findFirst({ where: { invoiceId: newInvoiceId } })
  return { id: pollOptionId }
}

export async function onPaid ({ invoice }, { tx }) {
  if (!invoice) return

  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  await tx.pollBlindVote.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  // anonymize the vote
  await tx.pollVote.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceId: null, invoiceActionState: null } })
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.pollBlindVote.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
  await tx.pollVote.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ id }, { actionId }) {
  return `SN: vote on poll #${id ?? actionId}`
}
