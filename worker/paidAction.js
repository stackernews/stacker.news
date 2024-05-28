import { paidActions } from '@/api/paidAction'

export async function settleAction ({ data: { invoiceId }, models }) {
  const invoice = await models.invoice.findUnique({
    where: { id: invoiceId }
  })

  // TODO: ensure that this is done only once
  await models.$transaction([
    models.invoice.update({
      where: { id: invoice.id },
      data: { actionState: 'PAID' }
    }),
    ...await paidActions[invoice.actionType].onPaidStatements({ invoice }, { models })
  ])
}

export async function settleActionError ({ data: { invoiceId }, models }) {
  const invoice = await models.invoice.findUnique({
    where: { id: invoiceId }
  })

  // TODO: ensure that this is done only once
  await models.$transaction([
    models.invoice.update({
      where: { id: invoice.id },
      data: { actionState: 'FAILED' }
    }),
    ...await paidActions[invoice.actionType].onFailedStatements({ invoice }, { models })
  ])
}
