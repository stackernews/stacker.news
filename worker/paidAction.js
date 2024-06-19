import { paidActions } from '@/api/paidAction'
import { datePivot } from '@/lib/time'
import { Prisma } from '@prisma/client'
import { getInvoice } from 'ln-service'

async function transitionInvoice (jobName, { invoiceId, fromState, toState, toData, onTransition }, { models, lnd, boss }) {
  let dbInvoice
  console.log(`${jobName}: transitioning invoice ${invoiceId} from ${fromState} to ${toState}`)

  try {
    dbInvoice = await models.invoice.findUnique({ where: { id: invoiceId } })
    const lndInvoice = await getInvoice({ id: dbInvoice.hash, lnd })
    const data = toData(lndInvoice)

    if (!Array.isArray(fromState)) {
      fromState = [fromState]
    }

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
        console.log(`${jobName}: record not found transitioning invoice ${invoiceId}:${dbInvoice.hash} from ${fromState} to ${toState}`)
        return
      }

      await onTransition({ lndInvoice, dbInvoice, tx })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

    console.log(`${jobName}: transitioned invoice ${invoiceId}:${dbInvoice.hash} from ${fromState} to ${toState}`)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        console.log(`${jobName}: record not found transitioning invoice ${dbInvoice?.hash} from ${fromState} to ${toState}`)
        return
      }
      if (e.code === 'P2034') {
        console.log(`${jobName}: write conflict transitioning invoice ${dbInvoice?.hash} from ${fromState} to ${toState}`)
        return
      }
    }

    console.error(`${jobName}: unexpected error transitioning invoice ${invoiceId}:${dbInvoice?.hash} from ${fromState} to ${toState}`, e)
    boss.send(
      jobName,
      { invoiceId },
      { startAfter: datePivot(new Date(), { minutes: 1 }), priority: 1000 })
  }
}

export async function settleAction ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('settleAction', {
    invoiceId,
    fromState: 'PENDING',
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
