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
        where: { id: dbInv.id, actionState: 'PENDING' },
        data: {
          actionState: 'PAID',
          confirmedAt: new Date(invoice.confirmed_at),
          confirmedIndex: invoice.confirmed_index,
          msatsReceived: BigInt(invoice.received_mtokens)
        }
      })

      await paidActions[dbInv.actionType].onPaid?.({ invoice: dbInv }, { models, tx })
      await tx.$executeRaw`INSERT INTO pgboss.job (name, data) VALUES ('checkStreak', jsonb_build_object('id', ${dbInv.userId}))`
    })
    console.log(`transitioned action ${dbInv.actionType} to PAID`)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // this error is thrown when we try to update a record that has been updated by another worker
      // so we just ignore it and let the other worker take the transition "lock" and perform the transition
      if (e.code === 'P2025') {
        console.error(`record not found ${dbInv?.hash}`)
        return
      }
      if (e.code === 'P2034') {
        console.error(`write conflict ${dbInv?.hash}`)
        return
      }
    }

    console.error(`unexpected error transitioning action ${dbInv?.actionType} to PAID`, e)
    boss.send(
      'settleAction',
      { invoiceId },
      { startAfter: datePivot(new Date(), { minutes: 1 }), priority: 1000 })
  }
}

export async function holdAction ({ data: { invoiceId }, models, lnd, boss }) {
  let dbInv

  try {
    dbInv = await models.invoice.findUnique({
      where: { id: invoiceId }
    })
    const invoice = await getInvoice({ id: dbInv.hash, lnd })

    if (!invoice.is_held) {
      throw new Error('invoice is not held')
    }

    await models.$transaction(async tx => {
      // optimistic concurrency control (aborts if invoice is not in PENDING_HELD state)
      await tx.invoice.update({
        where: { id: dbInv.id, actionState: 'PENDING_HELD' },
        data: {
          actionState: 'HELD',
          isHeld: true,
          msatsReceived: BigInt(invoice.received_mtokens)
        }
      })

      // Make sure that after payment, JIT invoices are settled
      // within 60 seconds or they will be canceled to minimize risk of
      // force closures or wallets banning us.
      const expiresAt = new Date(Math.min(dbInv.expiresAt, datePivot(new Date(), { seconds: 60 })))
      await models.$queryRaw`
        INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
        VALUES ('finalizeHodlInvoice', jsonb_build_object('hash', ${dbInv.hash}), 21, true, ${expiresAt})`
    })
    console.log(`transitioned action ${dbInv.actionType} to HELD`)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // this error is thrown when we try to update a record that has been updated by another worker
      // so we just ignore it and let the other worker take the transition "lock" and perform the transition
      if (e.code === 'P2025') {
        console.error(`record not found ${dbInv?.hash}`)
        return
      }
      if (e.code === 'P2034') {
        console.error(`write conflict ${dbInv?.hash}`)
        return
      }
    }

    console.error(`unexpected error transitioning action ${dbInv?.actionType} to HELD`, e)
    boss.send(
      'holdAction',
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

    if (!invoice.is_canceled) {
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
      await paidActions[dbInv.actionType].onFail?.({ invoice: dbInv }, { models, tx })
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
