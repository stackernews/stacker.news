import { getPaymentFailureStatus, hodlInvoiceCltvDetails, getPaymentOrNotSent } from '@/api/lnd'
import { paidActions } from '@/api/paidAction'
import { walletLogger } from '@/api/resolvers/wallet'
import { LND_PATHFINDING_TIME_PREF_PPM, LND_PATHFINDING_TIMEOUT_MS, PAID_ACTION_TERMINAL_STATES } from '@/lib/constants'
import { formatSats, msatsToSats, toPositiveNumber } from '@/lib/format'
import { datePivot } from '@/lib/time'
import { Prisma } from '@prisma/client'
import {
  cancelHodlInvoice,
  getInvoice, parsePaymentRequest,
  payViaPaymentRequest, settleHodlInvoice
} from 'ln-service'
import { MIN_SETTLEMENT_CLTV_DELTA } from '@/wallets/server/wrap'

// aggressive finalization retry options
const FINALIZE_OPTIONS = { retryLimit: 2 ** 31 - 1, retryBackoff: false, retryDelay: 5, priority: 1000 }

async function transitionInvoice (jobName,
  { invoiceId, fromState, toState, transition, invoice, onUnexpectedError },
  { models, lnd, boss }
) {
  console.group(`${jobName}: transitioning invoice ${invoiceId} from ${fromState} to ${toState}`)

  let dbInvoice
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

    const lndInvoice = invoice ?? await getInvoice({ id: currentDbInvoice.hash, lnd })

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
      dbInvoice = await tx.invoice.update({
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
    onUnexpectedError?.({ error: e, dbInvoice, models, boss })
    await boss.send(
      jobName,
      { invoiceId },
      { startAfter: datePivot(new Date(), { seconds: 30 }), priority: 1000 })
  } finally {
    console.groupEnd()
  }
}

async function performPessimisticAction ({ lndInvoice, dbInvoice, tx, lnd, boss }) {
  const args = { ...dbInvoice.actionArgs, invoiceId: dbInvoice.id }
  const context = {
    tx,
    cost: BigInt(lndInvoice.received_mtokens),
    me: dbInvoice.user
  }

  const sybilFeePercent = await paidActions[dbInvoice.actionType].getSybilFeePercent?.(args, context)

  const result = await paidActions[dbInvoice.actionType].perform(args, { ...context, sybilFeePercent })
  await tx.invoice.update({
    where: { id: dbInvoice.id },
    data: {
      actionResult: result,
      actionError: null
    }
  })
}

// if we experience an unexpected error when holding an invoice, we need aggressively attempt to cancel it
// store the error in the invoice, nonblocking and outside of this tx, finalizing immediately
function onHeldInvoiceError ({ error, dbInvoice, models, boss }) {
  models.invoice.update({
    where: { id: dbInvoice.id },
    data: {
      actionError: error.message
    }
  }).catch(e => console.error('failed to store action error', e))
  boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash }, FINALIZE_OPTIONS)
    .catch(e => console.error('failed to finalize', e))
}

export async function paidActionPaid ({ data: { invoiceId, ...args }, models, lnd, boss }) {
  const transitionedInvoice = await transitionInvoice('paidActionPaid', {
    invoiceId,
    fromState: ['HELD', 'PENDING', 'FORWARDED'],
    toState: 'PAID',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!lndInvoice.is_confirmed) {
        throw new Error('invoice is not confirmed')
      }

      const updateFields = {
        confirmedAt: new Date(lndInvoice.confirmed_at),
        confirmedIndex: lndInvoice.confirmed_index,
        msatsReceived: BigInt(lndInvoice.received_mtokens)
      }

      await paidActions[dbInvoice.actionType].onPaid?.({
        invoice: { ...dbInvoice, ...updateFields }
      }, { models, tx, lnd })

      // most paid actions are eligible for a cowboy hat streak
      await tx.$executeRaw`
        INSERT INTO pgboss.job (name, data)
        VALUES ('checkStreak', jsonb_build_object('id', ${dbInvoice.userId}, 'type', 'COWBOY_HAT'))`

      return updateFields
    },
    ...args
  }, { models, lnd, boss })

  if (transitionedInvoice) {
    // run non critical side effects in the background
    // after the transaction has been committed
    paidActions[transitionedInvoice.actionType]
      .nonCriticalSideEffects?.({ invoice: transitionedInvoice }, { models, lnd })
      .catch(console.error)
  }
}

// this performs forward creating the outgoing payment
export async function paidActionForwarding ({ data: { invoiceId, ...args }, models, lnd, boss }) {
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
    },
    onUnexpectedError: onHeldInvoiceError,
    ...args
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
      confidence: LND_PATHFINDING_TIME_PREF_PPM,
      max_timeout_height: maxTimeoutHeight
    }).catch(console.error)
  }
}

// this finalizes the forward by settling the incoming invoice after the outgoing payment is confirmed
export async function paidActionForwarded ({ data: { invoiceId, withdrawal, ...args }, models, lnd, boss }) {
  const transitionedInvoice = await transitionInvoice('paidActionForwarded', {
    invoiceId,
    fromState: 'FORWARDING',
    toState: 'FORWARDED',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!(lndInvoice.is_held || lndInvoice.is_confirmed)) {
        throw new Error('invoice is not held')
      }

      const { hash, msatsPaying, createdAt } = dbInvoice.invoiceForward.withdrawl
      const { payment, is_confirmed: isConfirmed } = withdrawal ??
        await getPaymentOrNotSent({ id: hash, lnd, createdAt })
      if (!isConfirmed) {
        throw new Error('payment is not confirmed')
      }

      // settle the invoice, allowing us to transition to PAID
      await settleHodlInvoice({ secret: payment.secret, lnd })

      return {
        preimage: payment.secret,
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
    },
    ...args
  }, { models, lnd, boss })

  if (transitionedInvoice) {
    const withdrawal = transitionedInvoice.invoiceForward.withdrawl

    const logger = walletLogger({ wallet: transitionedInvoice.invoiceForward.wallet, models })
    logger.ok(
      `↙ payment received: ${formatSats(msatsToSats(Number(withdrawal.msatsPaid)))}`, {
        invoiceId: transitionedInvoice.id,
        withdrawalId: withdrawal.id
      })
  }

  return transitionedInvoice
}

// when the pending forward fails, we need to cancel the incoming invoice
export async function paidActionFailedForward ({ data: { invoiceId, withdrawal: pWithdrawal, ...args }, models, lnd, boss }) {
  let message
  const transitionedInvoice = await transitionInvoice('paidActionFailedForward', {
    invoiceId,
    fromState: 'FORWARDING',
    toState: 'FAILED_FORWARD',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (!(lndInvoice.is_held || lndInvoice.is_cancelled)) {
        throw new Error('invoice is not held')
      }

      const { hash, createdAt } = dbInvoice.invoiceForward.withdrawl
      const withdrawal = pWithdrawal ?? await getPaymentOrNotSent({ id: hash, lnd, createdAt })

      if (!(withdrawal?.is_failed || withdrawal?.notSent)) {
        throw new Error('payment has not failed')
      }

      // cancel to transition to FAILED ... this is really important we do not transition unless this call succeeds
      // which once it does succeed will ensure we will try to cancel the held invoice until it actually cancels
      await boss.send('finalizeHodlInvoice', { hash: dbInvoice.hash }, FINALIZE_OPTIONS)

      const { status, message: failureMessage } = getPaymentFailureStatus(withdrawal)
      message = failureMessage

      return {
        invoiceForward: {
          update: {
            withdrawl: {
              update: {
                status
              }
            }
          }
        }
      }
    },
    ...args
  }, { models, lnd, boss })

  if (transitionedInvoice) {
    const fwd = transitionedInvoice.invoiceForward
    const logger = walletLogger({ wallet: fwd.wallet, models })
    logger.warn(
      `incoming payment failed: ${message}`, {
        withdrawalId: fwd.withdrawl.id
      })
  }

  return transitionedInvoice
}

export async function paidActionHeld ({ data: { invoiceId, ...args }, models, lnd, boss }) {
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
    },
    onUnexpectedError: onHeldInvoiceError,
    ...args
  }, { models, lnd, boss })
}

export async function paidActionCanceling ({ data: { invoiceId, ...args }, models, lnd, boss }) {
  const transitionedInvoice = await transitionInvoice('paidActionCanceling', {
    invoiceId,
    fromState: ['HELD', 'PENDING', 'PENDING_HELD', 'FAILED_FORWARD'],
    toState: 'CANCELING',
    transition: async ({ lndInvoice, dbInvoice, tx }) => {
      if (lndInvoice.is_confirmed) {
        throw new Error('invoice is confirmed already')
      }

      await cancelHodlInvoice({ id: dbInvoice.hash, lnd })
    },
    ...args
  }, { models, lnd, boss })

  if (transitionedInvoice) {
    if (transitionedInvoice.invoiceForward) {
      const { wallet, bolt11 } = transitionedInvoice.invoiceForward
      const logger = walletLogger({ wallet, models })
      const decoded = await parsePaymentRequest({ request: bolt11 })
      logger.info(
        `invoice for ${formatSats(msatsToSats(decoded.mtokens))} canceled by payer`, {
          bolt11,
          invoiceId: transitionedInvoice.id
        })
    }
  }

  return transitionedInvoice
}

export async function paidActionFailed ({ data: { invoiceId, ...args }, models, lnd, boss }) {
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
        cancelled: true,
        cancelledAt: new Date()
      }
    },
    ...args
  }, { models, lnd, boss })
}
