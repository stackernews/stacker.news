import { paidActions } from '@/api/paidAction'
import { datePivot } from '@/lib/time'
import { Prisma } from '@prisma/client'
import { getInvoice } from 'ln-service'

export async function settleAction ({ data: { invoiceId }, models, lnd, boss }) {
  let dbInv

  try {
    dbInv = await models.invoice.findUnique({
      where: { id: invoiceId }
    })
    const invoice = await getInvoice({ id: dbInv.hash, lnd })

    if (!invoice.is_confirmed) {
      throw new Error('invoice is not confirmed')
    }

    await models.$transaction(async tx => {
      // optimistic concurrency control (aborts if invoice is not in PENDING state)
      await tx.invoice.update({
        where: { id: invoice.id, actionState: 'PENDING' },
        data: {
          actionState: 'PAID',
          confirmedAt: new Date(invoice.confirmed_at),
          confirmedIndex: invoice.confirmed_index,
          msatsReceived: BigInt(invoice.received_mtokens)
        }
      })

      await paidActions[dbInv.actionType].onPaid?.({ invoice: dbInv }, { models, tx })
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // this error is thrown when we try to update a record that has been updated by another worker
      // so we just ignore it and let the other worker take the transition "lock" and perform the transition
      if (e.code === 'P2025') {
        return
      }
    }
    console.error(`unexpected error transitioning action ${dbInv.actionType} to PAID`, e)
    boss.send(
      'settleAction',
      { invoiceId },
      { startAfter: datePivot(new Date(), { minutes: 1 }), priority: 1000 })
  }
}

export async function settleActionError ({ data: { invoiceId }, models, lnd, boss }) {
  let dbInv

  try {
    dbInv = await models.invoice.findUnique({
      where: { id: invoiceId }
    })
    const invoice = await getInvoice({ id: dbInv.hash, lnd })

    if (!invoice.is_cancelled) {
      throw new Error('invoice is not cancelled')
    }

    await models.$transaction(async tx => {
      // optimistic concurrency control (aborts if invoice is not in PENDING state)
      await tx.invoice.update({
        where: { id: dbInv.id, actionState: 'PENDING' },
        data: {
          actionState: 'FAILED',
          cancelled: true
        }
      })
      await paidActions[invoice.actionType].onFailedStatements({ invoice: dbInv }, { models, tx })
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // this error is thrown when we try to update a record that has been updated by another worker
      // so we just ignore it and let the other worker take the transition "lock" and perform the transition
      if (e.code === 'P2025') {
        return
      }
    }
    console.error(`unexpected error transitioning action ${dbInv?.actionType} to FAILED`, e)
    boss.send(
      'settleActionError',
      { invoiceId },
      { startAfter: datePivot(new Date(), { minutes: 1 }), priority: 1000 })
  }
}
