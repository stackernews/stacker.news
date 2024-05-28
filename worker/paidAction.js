import { paidActions } from '@/api/paidAction'

export async function settleAction ({ data: { invoiceId }, models }) {
  const invoice = await models.invoice.findUnique({
    where: { id: invoiceId }
  })

  await models.$transaction([
    // optimistic concurrency control (aborts if invoice is not in PENDING state)
    models.invoice.update({
      where: { id: invoice.id, actionState: 'PENDING' },
      data: { actionState: 'PAID' }
    }),
    ...await paidActions[invoice.actionType].onPaidStatements({ invoice }, { models })
  ])
}

export async function settleActionError ({ data: { invoiceId }, models }) {
  const invoice = await models.invoice.findUnique({
    where: { id: invoiceId }
  })

  await models.$transaction([
    // optimistic concurrency control (aborts if invoice is not in PENDING state)
    models.invoice.update({
      where: { id: invoice.id, actionState: 'PENDING' },
      data: { actionState: 'FAILED' }
    }),
    ...await paidActions[invoice.actionType].onFailedStatements({ invoice }, { models })
  ])
}
