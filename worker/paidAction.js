import { getPaymentFailureStatus, hodlInvoiceCltvDetails } from '@/api/lnd'
import { paidActions } from '@/api/paidAction'
import { LND_PATHFINDING_TIMEOUT_MS, PAID_ACTION_TERMINAL_STATES } from '@/lib/constants'
import { datePivot } from '@/lib/time'
import { toPositiveNumber } from '@/lib/validate'
import { Prisma } from '@prisma/client'
import {
  cancelHodlInvoice,
  getInvoice, getPayment, parsePaymentRequest,
  payViaPaymentRequest, settleHodlInvoice
} from 'ln-service'
import { MIN_SETTLEMENT_CLTV_DELTA } from 'wallets/wrap'

// aggressive finalization retry options
const FINALIZE_OPTIONS = { retryLimit: 2 ** 31 - 1, retryBackoff: false, retryDelay: 5, priority: 1000 }

async function transitionInvoice (jobName, { invoiceId, fromState, toState, transition }, { models, lnd, boss }) {
  console.group(`${jobName}: transitioning invoice ${invoiceId} from ${fromState} to ${toState}`)

  try {
    const currentDbInvoice = await models.invoice.findUnique({ where: { id: invoiceId } })
    console.log('invoice is in state', currentDbInvoice.actionState)

    if (PAID_ACTION_TERMINAL_STATES.includes(currentDbInvoice.actionState)) {
      console.log('invoice is already in a terminal state, skipping transition')
      return
    }

    if (!Array.isArray(fromState)) {
      fromState = [fromState]
    }

    const lndInvoice = await getInvoice({ id: currentDbInvoice.hash, lnd })

    const transitionedInvoice = await models.$transaction(async tx => {
      const include = {
        user: true,
        invoiceForward: {
          include: {
            invoice: true,
            withdrawl: true,
            wallet: true
          }
        }
      }

      // grab optimistic concurrency lock and the invoice
      const dbInvoice = await tx.invoice.update({
        include,
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
        console.log('record not found in our own concurrency check, assuming concurrent worker transitioned it')
        return
      }

      const data = await transition({ lndInvoice, dbInvoice, tx })
      if (data) {
        return await tx.invoice.update({
          include,
          where: { id: dbInvoice.id },
          data
        })
      }

      return dbInvoice
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      // we only need to do this because we settleHodlInvoice inside the transaction
      // ... and it's prone to timing out
      timeout: 60000
    })

    if (transitionedInvoice) {
      console.log('transition succeeded')
      return transitionedInvoice
    }
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
    await boss.send(
      jobName,
      { invoiceId },
      { startAfter: datePivot(new Date(), { seconds: 30 }), priority: 1000 })
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
    boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash }, FINALIZE_OPTIONS)
      .catch(e => console.error('failed to finalize', e))
    throw e
  }
}

export async function paidActionPaid ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('paidActionPaid', {
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
export async function paidActionForwarding ({ data: { invoiceId }, models, lnd, boss }) {
  const transitionedInvoice = await transitionInvoice('paidActionForwarding', {
    invoiceId,
    fromState: 'PENDING_HELD',
    toState: 'FORWARDING',
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
      const invoice = await parsePaymentRequest({ request: bolt11 })
      // maxTimeoutDelta is the number of blocks left for the outgoing payment to settle
      const maxTimeoutDelta = toPositiveNumber(expiryHeight) - toPositiveNumber(acceptHeight) - MIN_SETTLEMENT_CLTV_DELTA
      if (maxTimeoutDelta - toPositiveNumber(invoice.cltv_delta) < 0) {
        // the payment will certainly fail, so we can
        // cancel and allow transition from PENDING[_HELD] -> FAILED
        boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash }, FINALIZE_OPTIONS)
          .catch(e => console.error('failed to finalize', e))
        throw new Error('invoice has insufficient cltv delta for forward')
      }

      // if this is a pessimistic action, we want to perform it now
      // ... we don't want it to fail after the outgoing payment is in flight
      if (!dbInvoice.actionOptimistic) {
        await performPessimisticAction({ lndInvoice, dbInvoice, tx, models, lnd, boss })
      }

      return {
        isHeld: true,
        msatsReceived: BigInt(lndInvoice.received_mtokens),
        invoiceForward: {
          update: {
            expiryHeight,
            acceptHeight,
            withdrawl: {
              create: {
                hash: invoice.id,
                bolt11,
                msatsPaying: BigInt(invoice.mtokens),
                msatsFeePaying: maxFeeMsats,
                autoWithdraw: true,
                walletId: invoiceForward.walletId,
                userId: invoiceForward.wallet.userId
              }
            }
          }
        }
      }
    }
  }, { models, lnd, boss })

  // only pay if we successfully transitioned which can only happen once
  // we can't do this inside the transaction because it isn't necessarily idempotent
  if (transitionedInvoice?.invoiceForward) {
    const { bolt11, maxFeeMsats, expiryHeight, acceptHeight } = transitionedInvoice.invoiceForward

    // give ourselves at least MIN_SETTLEMENT_CLTV_DELTA blocks to settle the incoming payment
    const maxTimeoutHeight = toPositiveNumber(toPositiveNumber(expiryHeight) - MIN_SETTLEMENT_CLTV_DELTA)

    console.log('forwarding with max fee', maxFeeMsats, 'max_timeout_height', maxTimeoutHeight,
      'accept_height', acceptHeight, 'expiry_height', expiryHeight)

    payViaPaymentRequest({
      lnd,
      request: bolt11,
      max_fee_mtokens: String(maxFeeMsats),
      pathfinding_timeout: LND_PATHFINDING_TIMEOUT_MS,
      max_timeout_height: maxTimeoutHeight
    }).catch(console.error)
  }
}

// this finalizes the forward by settling the incoming invoice after the outgoing payment is confirmed
export async function paidActionForwarded ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('paidActionForwarded', {
    invoiceId,
    fromState: 'FORWARDING',
    toState: 'FORWARDED',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!(lndInvoice.is_held || lndInvoice.is_confirmed)) {
        throw new Error('invoice is not held')
      }

      const { hash, msatsPaying } = dbInvoice.invoiceForward.withdrawl
      const { payment, is_confirmed: isConfirmed } = await getPayment({ id: hash, lnd })
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
                msatsPaid: msatsPaying,
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
export async function paidActionFailedForward ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('paidActionFailedForward', {
    invoiceId,
    fromState: 'FORWARDING',
    toState: 'FAILED_FORWARD',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!(lndInvoice.is_held || lndInvoice.is_cancelled)) {
        throw new Error('invoice is not held')
      }

      let withdrawal
      let notSent = false
      try {
        withdrawal = await getPayment({ id: dbInvoice.invoiceForward.withdrawl.hash, lnd })
      } catch (err) {
        if (err[1] === 'SentPaymentNotFound' &&
          dbInvoice.invoiceForward.withdrawl.createdAt < datePivot(new Date(), { milliseconds: -LND_PATHFINDING_TIMEOUT_MS * 2 })) {
          // if the payment is older than 2x timeout, but not found in LND, we can assume it errored before lnd stored it
          notSent = true
        } else {
          throw err
        }
      }

      if (!(withdrawal?.is_failed || notSent)) {
        throw new Error('payment has not failed')
      }

      // cancel to transition to FAILED ... this is really important we do not transition unless this call succeeds
      // which once it does succeed will ensure we will try to cancel the held invoice until it actually cancels
      await boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash }, FINALIZE_OPTIONS)

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

export async function paidActionHeld ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('paidActionHeld', {
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

      if (dbInvoice.invoiceForward) {
        throw new Error('invoice is associated with a forward')
      }

      // make sure settled or cancelled in 60 seconds to minimize risk of force closures
      const expiresAt = new Date(Math.min(dbInvoice.expiresAt, datePivot(new Date(), { seconds: 60 })))
      boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash }, { startAfter: expiresAt, ...FINALIZE_OPTIONS })
        .catch(e => console.error('failed to finalize', e))

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

export async function paidActionCanceling ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('paidActionCanceling', {
    invoiceId,
    fromState: ['HELD', 'PENDING', 'PENDING_HELD', 'FAILED_FORWARD'],
    toState: 'CANCELING',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (lndInvoice.is_confirmed) {
        throw new Error('invoice is confirmed already')
      }

      await cancelHodlInvoice({ id: dbInvoice.hash, lnd })
    }
  }, { models, lnd, boss })
}

export async function paidActionFailed ({ data: { invoiceId }, models, lnd, boss }) {
  return await transitionInvoice('paidActionFailed', {
    invoiceId,
    // any of these states can transition to FAILED
    fromState: ['PENDING', 'PENDING_HELD', 'HELD', 'FAILED_FORWARD', 'CANCELING'],
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
