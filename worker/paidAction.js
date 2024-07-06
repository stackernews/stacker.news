import { paidActions } from '@/api/paidAction'
import { datePivot } from '@/lib/time'
import { Prisma } from '@prisma/client'
import { getInvoice, settleHodlInvoice } from 'ln-service'

async function transitionInvoice (jobName, { invoiceId, fromState, toState, toData, onTransition }, { models, lnd, boss }) {
  console.group(`${jobName}: transitioning invoice ${invoiceId} from ${fromState} to ${toState}`)

  let dbInvoice
  try {
    dbInvoice = await models.invoice.findUnique({ where: { id: invoiceId } })
    console.log('invoice is in state', dbInvoice.actionState)

    if (['FAILED', 'PAID'].includes(dbInvoice.actionState)) {
      console.log('invoice is already in a terminal state, skipping transition')
      return
    }

    const lndInvoice = await getInvoice({ id: dbInvoice.hash, lnd })
    const data = toData(lndInvoice)

    if (!Array.isArray(fromState)) {
      fromState = [fromState]
    }

    await models.$transaction(async tx => {
      dbInvoice = await tx.invoice.update({
        include: { user: true },
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
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      // we only need to do this because we settleHodlInvoice inside the transaction
      // ... and it's prone to timing out
      timeout: 60000
    })

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
      // XXX allow both held and confirmed invoices to do this transition
      // because it's possible for a prior settleHodlInvoice to have succeeded but
      // timeout and rollback the transaction, leaving the invoice in a pending_held state
      if (!(invoice.is_held || invoice.is_confirmed)) {
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
      // do outside of transaction because we don't want this to rollback if the rest of the job fails
      await models.$executeRaw`
        INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
        VALUES ('finalizeHodlInvoice', jsonb_build_object('hash', ${dbInvoice.hash}), 21, true, ${expiresAt})`

      // perform the action now that we have the funds
      try {
        const args = { ...dbInvoice.actionArgs, invoiceId: dbInvoice.id }
        const result = await paidActions[dbInvoice.actionType].perform(args,
          { models, tx, lnd, cost: dbInvoice.msatsReceived, me: dbInvoice.user })
        await tx.invoice.update({
          where: { id: dbInvoice.id },
          data: {
            actionResult: result,
            actionError: null
          }
        })
      } catch (e) {
        // store the error in the invoice, nonblocking and outside of this tx, finalizing immediately
        models.invoice.update({
          where: { id: dbInvoice.id },
          data: {
            actionError: e.message
          }
        }).catch(e => console.error('failed to cancel invoice', e))
        boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash })
        throw e
      }

      // settle the invoice, allowing us to transition to PAID
      await settleHodlInvoice({ secret: dbInvoice.preimage, lnd })
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
