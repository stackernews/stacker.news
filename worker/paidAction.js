import { paidActions } from '@/api/paidAction'
import { datePivot } from '@/lib/time'
import { Prisma } from '@prisma/client'
import { getInvoice } from 'ln-service'

async function transitionInvoice (jobName, { invoiceId, fromState, toState, toData, onTransition }, { models, lnd, boss }) {
  console.group(`${jobName}: transitioning invoice ${invoiceId} from ${fromState} to ${toState}`)

  let dbInvoice
  try {
    console.log('fetching invoice from db')

    dbInvoice = await models.invoice.findUnique({ where: { id: invoiceId } })
    const lndInvoice = await getInvoice({ id: dbInvoice.hash, lnd })
    const data = toData(lndInvoice)

    if (!Array.isArray(fromState)) {
      fromState = [fromState]
    }

    console.log('invoice is in state', dbInvoice.actionState)

    await models.$transaction(async tx => {
      dbInvoice = await tx.invoice.update({
        where: {
          id: invoiceId,
          actionState: {
            in: fromState
          }
        },
        data: {
          actionState: toState,
          ...data
        }
      })

      // our own optimistic concurrency check
      if (!dbInvoice) {
        console.log('record not found, assuming concurrent worker transitioned it')
        return
      }

      await onTransition({ lndInvoice, dbInvoice, tx })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

    console.log('transition succeeded')
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        console.log('record not found, assuming concurrent worker transitioned it')
        return
      }
      if (e.code === 'P2034') {
        console.log('write conflict, assuming concurrent worker is transitioning it')
        return
      }
    }

    console.error('unexpected error', e)
    boss.send(
      jobName,
      { invoiceId },
      { startAfter: datePivot(new Date(), { minutes: 1 }), priority: 1000 })
  } finally {
    console.groupEnd()
  }
}

export async function settleAction ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('settleAction', {
    invoiceId,
    fromState: ['HELD', 'PENDING'],
    toState: 'PAID',
    toData: invoice => {
      if (!invoice.is_confirmed) {
        throw new Error('invoice is not confirmed')
      }
      return {
        confirmedAt: new Date(invoice.confirmed_at),
        confirmedIndex: invoice.confirmed_index,
        msatsReceived: BigInt(invoice.received_mtokens)
      }
    },
    onTransition: async ({ dbInvoice, tx }) => {
      await paidActions[dbInvoice.actionType].onPaid?.({ invoice: dbInvoice }, { models, tx, lnd })
      await tx.$executeRaw`INSERT INTO pgboss.job (name, data) VALUES ('checkStreak', jsonb_build_object('id', ${dbInvoice.userId}))`
    }
  }, { models, lnd, boss })
}

export async function holdAction ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('holdAction', {
    invoiceId,
    fromState: 'PENDING_HELD',
    toState: 'HELD',
    toData: invoice => {
      if (!invoice.is_held) {
        throw new Error('invoice is not held')
      }
      return {
        isHeld: true,
        msatsReceived: BigInt(invoice.received_mtokens)
      }
    },
    onTransition: async ({ dbInvoice, tx }) => {
      // make sure settled or cancelled in 60 seconds to minimize risk of force closures
      const expiresAt = new Date(Math.min(dbInvoice.expiresAt, datePivot(new Date(), { seconds: 60 })))
      await tx.$executeRaw`
        INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
        VALUES ('finalizeHodlInvoice', jsonb_build_object('hash', ${dbInvoice.hash}), 21, true, ${expiresAt})`
    }
  }, { models, lnd, boss })
}

export async function settleActionError ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('settleActionError', {
    invoiceId,
    // any of these states can transition to FAILED
    fromState: ['PENDING', 'PENDING_HELD', 'HELD'],
    toState: 'FAILED',
    toData: invoice => {
      if (!invoice.is_canceled) {
        throw new Error('invoice is not cancelled')
      }
      return {
        cancelled: true
      }
    },
    onTransition: async ({ dbInvoice, tx }) => {
      await paidActions[dbInvoice.actionType].onFail?.({ invoice: dbInvoice }, { models, tx, lnd })
    }
  }, { models, lnd, boss })
}
