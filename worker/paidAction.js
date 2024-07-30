import { getPaymentFailureStatus, hodlInvoiceCltvDetails } from '@/api/lnd'
import { paidActions } from '@/api/paidAction'
import { datePivot } from '@/lib/time'
import { Prisma } from '@prisma/client'
import { getInvoice, getPayment, parsePaymentRequest, payViaPaymentRequest, settleHodlInvoice } from 'ln-service'
import { MIN_SETTLEMENT_CLTV_DELTA } from 'wallets/wrap'

async function transitionInvoice (jobName, { invoiceId, fromState, toState, transition }, { models, lnd, boss }) {
  console.group(`${jobName}: transitioning invoice ${invoiceId} from ${fromState} to ${toState}`)

  let dbInvoice
  try {
    dbInvoice = await models.invoice.findUnique({ where: { id: invoiceId } })
    console.log('invoice is in state', dbInvoice.actionState)

    if (['FAILED', 'PAID'].includes(dbInvoice.actionState)) {
      console.log('invoice is already in a terminal state, skipping transition')
      return
    }

    if (!Array.isArray(fromState)) {
      fromState = [fromState]
    }

    const lndInvoice = await getInvoice({ id: dbInvoice.hash, lnd })

    await models.$transaction(async tx => {
      // grab optimistic concurrency lock and the invoice
      dbInvoice = await tx.invoice.update({
        include: {
          user: true,
          invoiceForward: {
            include: {
              invoice: true,
              withdrawl: true,
              wallet: true
            }
          }
        },
        where: {
          id: invoiceId,
          actionState: {
            in: fromState
          }
        },
        data: {
          actionState: toState
        }
      })

      // our own optimistic concurrency check
      if (!dbInvoice) {
        console.log('record not found, assuming concurrent worker transitioned it')
        return
      }

      const data = await transition({ lndInvoice, dbInvoice, tx })

      await tx.invoice.update({
        where: { id: dbInvoice.id },
        data
      })
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

async function performPessimisticAction ({ lndInvoice, dbInvoice, tx, models, lnd, boss }) {
  try {
    const args = { ...dbInvoice.actionArgs, invoiceId: dbInvoice.id }
    const result = await paidActions[dbInvoice.actionType].perform(args,
      { models, tx, lnd, cost: BigInt(lndInvoice.received_mtokens), me: dbInvoice.user })
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
    }).catch(e => console.error('failed to store action error', e))
    boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash })
    throw e
  }
}

export async function settleAction ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('settleAction', {
    invoiceId,
    fromState: ['HELD', 'PENDING', 'FORWARDED'],
    toState: 'PAID',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!lndInvoice.is_confirmed) {
        throw new Error('invoice is not confirmed')
      }

      await paidActions[dbInvoice.actionType].onPaid?.({ invoice: dbInvoice }, { models, tx, lnd })
      await tx.$executeRaw`
        INSERT INTO pgboss.job (name, data)
        VALUES ('checkStreak', jsonb_build_object('id', ${dbInvoice.userId}))`

      return {
        confirmedAt: new Date(lndInvoice.confirmed_at),
        confirmedIndex: lndInvoice.confirmed_index,
        msatsReceived: BigInt(lndInvoice.received_mtokens)
      }
    }
  }, { models, lnd, boss })
}

// this performs forward creating the outgoing payment
export async function forwardAction ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('forwardAction', {
    invoiceId,
    // optimistic actions use PENDING as starting state even if we're using a forward invoice
    fromState: ['PENDING_HELD', 'PENDING'],
    toState: 'PENDING_FORWARD',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!lndInvoice.is_held) {
        throw new Error('invoice is not held')
      }

      const { invoiceForward } = dbInvoice
      if (!invoiceForward) {
        throw new Error('invoice is not associated with a forward')
      }

      const { expiryHeight, acceptHeight } = hodlInvoiceCltvDetails(lndInvoice)
      const { bolt11, maxFeeMsats } = invoiceForward
      if (expiryHeight - acceptHeight < MIN_SETTLEMENT_CLTV_DELTA) {
        // cancel
        boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash })
        return
      }

      // if this is a pessimistic action, we want to perform it now
      // ... we don't want it to fail after the outgoing payment is in flight
      if (!dbInvoice.actionOptimistic) {
        await performPessimisticAction({ lndInvoice, dbInvoice, tx, models, lnd, boss })
      }

      const invoice = await parsePaymentRequest({ request: bolt11 })

      // create the withdrawl record outside of the transaction in case the tx fails
      const withdrawal = await models.withdrawl.create({
        data: {
          hash: invoice.id,
          bolt11,
          msatsPaying: BigInt(invoice.mtokens),
          msatsFeePaying: maxFeeMsats,
          autoWithdraw: true,
          walletId: invoiceForward.walletId,
          userId: invoiceForward.wallet.userId
        }
      })

      payViaPaymentRequest({
        lnd,
        request: bolt11,
        max_fee_mtokens: String(maxFeeMsats),
        pathfinding_timeout: 30000,
        max_timeout_height: expiryHeight - acceptHeight - MIN_SETTLEMENT_CLTV_DELTA
      }).catch(console.error)

      return {
        isHeld: true,
        msatsReceived: BigInt(lndInvoice.received_mtokens),
        invoiceForward: {
          update: {
            expiryHeight,
            acceptHeight,
            withdrawl: {
              connect: {
                id: withdrawal.id
              }
            }
          }
        }
      }
    }
  }, { models, lnd, boss })
}

// this finalizes the forward by settling the incoming invoice after the outgoing payment is confirmed
export async function settleForwardAction ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('settleForwardAction', {
    invoiceId,
    fromState: 'PENDING_FORWARD',
    toState: 'FORWARDED',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!(lndInvoice.is_held || lndInvoice.is_confirmed)) {
        throw new Error('invoice is not held')
      }

      const { payment, is_confirmed: isConfirmed } = await getPayment({ id: dbInvoice.invoiceForward.withdrawl.hash, lnd })
      if (!isConfirmed) {
        throw new Error('payment is not confirmed')
      }

      // settle the invoice, allowing us to transition to PAID
      await settleHodlInvoice({ secret: payment.secret, lnd })

      return {
        invoiceForward: {
          update: {
            withdrawl: {
              update: {
                status: 'CONFIRMED',
                msatsPaid: BigInt(payment.mtokens),
                msatsFeePaid: BigInt(payment.fee_mtokens),
                preimage: payment.secret
              }
            }
          }
        }
      }
    }
  }, { models, lnd, boss })
}

// when the pending forward fails, we need to cancel the incoming invoice
export async function forwardActionError ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('forwardActionError', {
    invoiceId,
    fromState: 'PENDING_FORWARD',
    toState: 'FAILED_FORWARD',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!lndInvoice.is_held) {
        throw new Error('invoice is not held')
      }

      const withdrawal = await getPayment({ id: dbInvoice.invoiceForward.withdrawl.hash, lnd })
      if (!withdrawal?.is_failed) {
        throw new Error('payment has not failed')
      }

      // cancel to transition to FAILED ... independent of the state transition
      boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash })

      return {
        invoiceForward: {
          update: {
            withdrawl: {
              update: {
                status: getPaymentFailureStatus(withdrawal)
              }
            }
          }
        }
      }
    }
  }, { models, lnd, boss })
}

export async function holdAction ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('holdAction', {
    invoiceId,
    fromState: 'PENDING_HELD',
    toState: 'HELD',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      // XXX allow both held and confirmed invoices to do this transition
      // because it's possible for a prior settleHodlInvoice to have succeeded but
      // timeout and rollback the transaction, leaving the invoice in a pending_held state
      if (!(lndInvoice.is_held || lndInvoice.is_confirmed)) {
        throw new Error('invoice is not held')
      }

      // make sure settled or cancelled in 60 seconds to minimize risk of force closures
      const expiresAt = new Date(Math.min(dbInvoice.expiresAt, datePivot(new Date(), { seconds: 60 })))
      // do outside of transaction because we don't want this to rollback if the rest of the job fails
      await models.$executeRaw`
        INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
        VALUES ('finalizeHodlInvoice', jsonb_build_object('hash', ${dbInvoice.hash}), 21, true, ${expiresAt})`

      // perform the action now that we have the funds
      await performPessimisticAction({ lndInvoice, dbInvoice, tx, models, lnd, boss })

      // settle the invoice, allowing us to transition to PAID
      await settleHodlInvoice({ secret: dbInvoice.preimage, lnd })

      return {
        isHeld: true,
        msatsReceived: BigInt(lndInvoice.received_mtokens)
      }
    }
  }, { models, lnd, boss })
}

export async function settleActionError ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('settleActionError', {
    invoiceId,
    // any of these states can transition to FAILED
    fromState: ['PENDING', 'PENDING_HELD', 'HELD', 'FAILED_FORWARD'],
    toState: 'FAILED',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!lndInvoice.is_canceled) {
        throw new Error('invoice is not cancelled')
      }

      await paidActions[dbInvoice.actionType].onFail?.({ invoice: dbInvoice }, { models, tx, lnd })

      return {
        cancelled: true
      }
    }
  }, { models, lnd, boss })
}
