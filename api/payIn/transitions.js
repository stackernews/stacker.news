import { datePivot } from '@/lib/time'
import { Prisma } from '@prisma/client'
import { onBegin, onFail, onPaid } from '.'
import { walletLogger } from '@/wallets/server/logger'
import payInTypeModules from './types'
import { getPaymentFailureStatus, getPaymentOrNotSent, hodlInvoiceCltvDetails } from '../lnd'
import { cancelHodlInvoice, parsePaymentRequest, payViaPaymentRequest, settleHodlInvoice, getInvoice } from 'ln-service'
import { toPositiveNumber, formatSats, msatsToSats, toPositiveBigInt, formatMsats } from '@/lib/format'
import { MIN_SETTLEMENT_CLTV_DELTA } from '@/wallets/server/wrap'
import { LND_PATHFINDING_TIME_PREF_PPM, LND_PATHFINDING_TIMEOUT_MS } from '@/lib/constants'
import { notifyWithdrawal } from '@/lib/webPush'
import { PayInFailureReasonError } from './errors'
export const PAY_IN_TERMINAL_STATES = ['PAID', 'FAILED']
const FINALIZE_OPTIONS = { retryLimit: 2 ** 31 - 1, retryBackoff: false, retryDelay: 5, priority: 1000 }

async function transitionPayIn (jobName, data,
  { payInId, fromStates, toState, transitionFunc, cancelOnError },
  { invoice, withdrawal, models, boss, lnd }) {
  let payIn

  try {
    const include = { payInBolt11: true, payInCustodialTokens: true, payOutBolt11: true, pessimisticEnv: true, payOutCustodialTokens: true, beneficiaries: true }
    const currentPayIn = await models.payIn.findUnique({ where: { id: payInId }, include })

    console.group(`${jobName}: transitioning payIn ${payInId} from ${fromStates} to ${toState}`)
    console.log('currentPayIn', currentPayIn)

    if (PAY_IN_TERMINAL_STATES.includes(currentPayIn.payInState)) {
      console.log('payIn is already in a terminal state, skipping transition')
      return
    }

    if (!Array.isArray(fromStates)) {
      fromStates = [fromStates]
    }

    let lndPayInBolt11
    if (currentPayIn.payInBolt11) {
      lndPayInBolt11 = invoice ?? await getInvoice({ id: currentPayIn.payInBolt11.hash, lnd })
    }

    let lndPayOutBolt11
    if (currentPayIn.payOutBolt11) {
      lndPayOutBolt11 = withdrawal ?? await getPaymentOrNotSent({ id: currentPayIn.payOutBolt11.hash, lnd })
    }

    const transitionedPayIn = await models.$transaction(async tx => {
      payIn = await tx.payIn.update({
        where: {
          id: payInId,
          payInState: { in: fromStates }
        },
        data: {
          payInState: toState,
          payInStateChangedAt: new Date(),
          beneficiaries: {
            updateMany: {
              data: {
                payInState: toState,
                payInStateChangedAt: new Date()
              },
              where: {
                benefactorId: payInId
              }
            }
          }
        },
        include
      })

      if (!payIn) {
        console.log('record not found in our own concurrency check, assuming concurrent worker transitioned it')
        return
      }

      const updateFields = await transitionFunc({ tx, payIn, lndPayInBolt11, lndPayOutBolt11 })

      if (updateFields) {
        return await tx.payIn.update({
          where: { id: payIn.id },
          data: updateFields,
          include
        })
      }

      return payIn
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 60000
    })

    if (transitionedPayIn) {
      console.log('transition succeeded')
      return transitionedPayIn
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        console.log('record not found, assuming concurrent worker transitioned it')
        return
      }
      if (error.code === 'P2034') {
        console.log('write conflict, assuming concurrent worker is transitioning it')
        return
      }
    }

    console.error('unexpected error', error)
    if (cancelOnError) {
      models.pessimisticEnv.updateMany({
        where: { payInId },
        data: {
          error: error.message
        }
      }).catch(e => console.error('failed to store payIn error', e))
      const reason = error instanceof PayInFailureReasonError
        ? error.payInFailureReason
        : 'EXECUTION_FAILED'
      boss.send('payInCancel', { payInId, payInFailureReason: reason }, FINALIZE_OPTIONS)
        .catch(e => console.error('failed to cancel payIn', e))
    } else {
      // retry the job
      boss.send(
        jobName,
        data,
        { startAfter: datePivot(new Date(), { seconds: 30 }), priority: 1000 })
        .catch(e => console.error('failed to retry payIn', e))
    }

    console.error(`${jobName} failed for payIn ${payInId}: ${error}`)
    throw error
  } finally {
    console.groupEnd()
  }
}

export async function payInWithdrawalPaid ({ data, models, ...args }) {
  const { payInId } = data

  const transitionedPayIn = await transitionPayIn('payInWithdrawalPaid', data, {
    payInId,
    fromStates: 'PENDING_WITHDRAWAL',
    toState: 'PAID',
    transitionFunc: async ({ tx, payIn, lndPayOutBolt11 }) => {
      if (!lndPayOutBolt11.is_confirmed) {
        throw new Error('withdrawal is not confirmed')
      }

      // refund the routing fee
      const { mtokens, id: routingFeeId } = payIn.payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')
      await tx.payOutCustodialToken.update({
        where: { id: routingFeeId },
        data: {
          mtokens: toPositiveBigInt(lndPayOutBolt11.payment.fee_mtokens)
        }
      })
      if (mtokens - toPositiveBigInt(lndPayOutBolt11.payment.fee_mtokens) > 0) {
        await tx.payOutCustodialToken.create({
          data: {
            mtokens: mtokens - toPositiveBigInt(lndPayOutBolt11.payment.fee_mtokens),
            userId: payIn.userId,
            payOutType: 'ROUTING_FEE_REFUND',
            custodialTokenType: 'SATS',
            payInId: payIn.id
          }
        })
      }

      await onPaid(tx, payIn.id)

      return {
        payOutBolt11: {
          update: {
            status: 'CONFIRMED',
            preimage: lndPayOutBolt11.payment.secret
          }
        }
      }
    }
  }, { models, ...args })

  if (transitionedPayIn) {
    await notifyWithdrawal(transitionedPayIn)
    const { payOutBolt11 } = transitionedPayIn
    if (payOutBolt11?.protocolId) {
      const logger = walletLogger({ protocolId: payOutBolt11.protocolId, userId: payOutBolt11.userId, models })
      logger?.ok(
        `↙ payment received: ${formatSats(msatsToSats(payOutBolt11.msats))}`, {
          withdrawalId: payOutBolt11.id
        })
    }
  }
}

export async function payInWithdrawalFailed ({ data, models, ...args }) {
  const { payInId } = data
  let message
  const transitionedPayIn = await transitionPayIn('payInWithdrawalFailed', data, {
    payInId,
    fromStates: 'PENDING_WITHDRAWAL',
    toState: 'FAILED',
    transitionFunc: async ({ tx, payIn, lndPayOutBolt11 }) => {
      if (!lndPayOutBolt11?.is_failed) {
        throw new Error('withdrawal is not failed')
      }

      await onFail(tx, payIn.id)

      const { status, message: failureMessage } = getPaymentFailureStatus(lndPayOutBolt11)
      message = failureMessage

      return {
        payInFailureReason: 'WITHDRAWAL_FAILED',
        payOutBolt11: {
          update: { status }
        }
      }
    }
  }, { models, ...args })

  if (transitionedPayIn) {
    const { mtokens } = transitionedPayIn.payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')
    const { payOutBolt11 } = transitionedPayIn
    if (payOutBolt11?.protocolId) {
      const logger = walletLogger({ protocolId: payOutBolt11.protocolId, userId: payOutBolt11.userId, models })
      logger?.error(`incoming payment failed: ${message}`, {
        bolt11: payOutBolt11.bolt11,
        max_fee: formatMsats(mtokens)
      })
    }
  }
}

export async function payInPaid ({ data, models, ...args }) {
  const { payInId } = data
  const transitionedPayIn = await transitionPayIn('payInPaid', data, {
    payInId,
    fromStates: ['HELD', 'PENDING', 'FORWARDED'],
    toState: 'PAID',
    transitionFunc: async ({ tx, payIn, lndPayInBolt11 }) => {
      if (!lndPayInBolt11.is_confirmed) {
        throw new Error('invoice is not confirmed')
      }

      await onPaid(tx, payIn.id)

      return {
        payInBolt11: {
          update: {
            confirmedAt: new Date(lndPayInBolt11.confirmed_at),
            confirmedIndex: lndPayInBolt11.confirmed_index,
            msatsReceived: BigInt(lndPayInBolt11.received_mtokens)
          }
        }
      }
    }
  }, { models, ...args })

  if (transitionedPayIn) {
    // run non critical side effects in the background
    // after the transaction has been committed
    payInTypeModules[transitionedPayIn.payInType]
      .nonCriticalSideEffects?.(payInId, { models })
      .catch(console.error)
  }
}

// this performs forward creating the outgoing payment
export async function payInForwarding ({ data, models, boss, lnd, ...args }) {
  const { payInId } = data
  const transitionedPayIn = await transitionPayIn('payInForwarding', data, {
    payInId,
    fromStates: 'PENDING_HELD',
    toState: 'FORWARDING',
    transitionFunc: async ({ tx, payIn, lndPayInBolt11 }) => {
      if (!lndPayInBolt11.is_held) {
        throw new Error('invoice is not held')
      }

      if (!payIn.payOutBolt11) {
        throw new Error('invoice is not associated with a forward')
      }

      const { expiryHeight, acceptHeight } = hodlInvoiceCltvDetails(lndPayInBolt11)
      const invoice = await parsePaymentRequest({ request: payIn.payOutBolt11.bolt11 })
      // maxTimeoutDelta is the number of blocks left for the outgoing payment to settle
      const maxTimeoutDelta = toPositiveNumber(expiryHeight) - toPositiveNumber(acceptHeight) - MIN_SETTLEMENT_CLTV_DELTA
      if (maxTimeoutDelta - toPositiveNumber(invoice.cltv_delta) < 0) {
        // the payment will certainly fail, so we can
        // cancel and allow transition from PENDING[_HELD] -> FAILED
        throw new PayInFailureReasonError('invoice has insufficient cltv delta for forward', 'INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW')
      }

      // if this is a pessimistic action, we want to perform it now
      // ... we don't want it to fail after the outgoing payment is in flight
      let pessimisticEnv
      if (payIn.pessimisticEnv) {
        pessimisticEnv = {
          update: {
            result: await payInTypeModules[payIn.payInType].onBegin?.(tx, payIn.id, payIn.pessimisticEnv.args)
          }
        }
      }

      return {
        payInBolt11: {
          update: {
            msatsReceived: BigInt(lndPayInBolt11.received_mtokens),
            expiryHeight,
            acceptHeight
          }
        },
        pessimisticEnv
      }
    },
    cancelOnError: true
  }, { models, boss, lnd, ...args })

  // only pay if we successfully transitioned which can only happen once
  // we can't do this inside the transaction because it isn't necessarily idempotent
  if (transitionedPayIn?.payInBolt11 && transitionedPayIn.payOutBolt11) {
    const { expiryHeight, acceptHeight } = transitionedPayIn.payInBolt11
    const { mtokens: mtokensFee } = transitionedPayIn.payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')

    // give ourselves at least MIN_SETTLEMENT_CLTV_DELTA blocks to settle the incoming payment
    const maxTimeoutHeight = toPositiveNumber(toPositiveNumber(expiryHeight) - MIN_SETTLEMENT_CLTV_DELTA)

    console.log('forwarding with max fee', mtokensFee, 'max_timeout_height', maxTimeoutHeight,
      'accept_height', acceptHeight, 'expiry_height', expiryHeight)

    payViaPaymentRequest({
      lnd,
      request: transitionedPayIn.payOutBolt11.bolt11,
      max_fee_mtokens: String(mtokensFee),
      pathfinding_timeout: LND_PATHFINDING_TIMEOUT_MS,
      confidence: LND_PATHFINDING_TIME_PREF_PPM,
      max_timeout_height: maxTimeoutHeight
    }).catch(
      e => {
        console.error('failed to forward', e)
        boss.send('payInCancel', { payInId, payInFailureReason: 'INVOICE_FORWARDING_FAILED' }, FINALIZE_OPTIONS)
          .catch(e => console.error('failed to cancel payIn', e))
      }
    )
  }
}

// this finalizes the forward by settling the incoming invoice after the outgoing payment is confirmed
export async function payInForwarded ({ data, models, lnd, boss, ...args }) {
  const { payInId } = data
  const transitionedPayIn = await transitionPayIn('payInForwarded', data, {
    payInId,
    fromStates: 'FORWARDING',
    toState: 'FORWARDED',
    transitionFunc: async ({ tx, payIn, lndPayInBolt11, lndPayOutBolt11 }) => {
      if (!(lndPayInBolt11.is_held || lndPayInBolt11.is_confirmed)) {
        throw new Error('invoice is not held')
      }

      if (!lndPayOutBolt11.is_confirmed) {
        throw new Error('payment is not confirmed')
      }

      const { payment } = lndPayOutBolt11

      // settle the invoice, allowing us to transition to PAID
      await settleHodlInvoice({ secret: payment.secret, lnd })

      // adjust the routing fee and move the rest to the rewards pool
      const { mtokens: mtokensFeeEstimated, id: payOutRoutingFeeId } = payIn.payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')
      const { id: payOutRewardsPoolId } = payIn.payOutCustodialTokens.find(t => t.payOutType === 'REWARDS_POOL')

      return {
        payInBolt11: {
          update: {
            preimage: payment.secret
          }
        },
        payOutBolt11: {
          update: {
            status: 'CONFIRMED',
            preimage: payment.secret
          }
        },
        payOutCustodialTokens: {
          update: [
            {
              data: { mtokens: BigInt(payment.fee_mtokens) },
              where: { id: payOutRoutingFeeId }
            },
            {
              data: { mtokens: { increment: (mtokensFeeEstimated - BigInt(payment.fee_mtokens)) } },
              where: { id: payOutRewardsPoolId }
            }
          ]
        }
      }
    }
  }, { models, lnd, boss, ...args })

  if (transitionedPayIn) {
    const { msats, protocolId, userId } = transitionedPayIn.payOutBolt11

    const logger = walletLogger({ protocolId, userId, models })
    logger.ok(
      `↙ payment received: ${formatSats(msatsToSats(Number(msats)))}`, {
        payInId: transitionedPayIn.id
      })
  }

  return transitionedPayIn
}

// when the pending forward fails, we need to cancel the incoming invoice
export async function payInFailedForward ({ data, models, lnd, boss, ...args }) {
  const { payInId } = data
  let message
  const transitionedPayIn = await transitionPayIn('payInFailedForward', data, {
    payInId,
    fromStates: 'FORWARDING',
    toState: 'FAILED_FORWARD',
    transitionFunc: async ({ tx, payIn, lndPayInBolt11, lndPayOutBolt11 }) => {
      if (!(lndPayInBolt11.is_held || lndPayInBolt11.is_cancelled)) {
        throw new Error('invoice is not held')
      }

      if (!(lndPayOutBolt11.is_failed || lndPayOutBolt11.notSent)) {
        throw new Error('payment is not failed')
      }

      // cancel to transition to FAILED ... this is really important we do not transition unless this call succeeds
      // which once it does succeed will ensure we will try to cancel the held invoice until it actually cancels
      await boss.send('payInCancel', { payInId, payInFailureReason: 'INVOICE_FORWARDING_FAILED' }, FINALIZE_OPTIONS)

      const { status, message: failureMessage } = getPaymentFailureStatus(lndPayOutBolt11)
      message = failureMessage

      return {
        payOutBolt11: {
          update: {
            status
          }
        }
      }
    }
  }, { models, lnd, boss, ...args })

  if (transitionedPayIn) {
    const fwd = transitionedPayIn.payOutBolt11
    const logger = walletLogger({ wallet: fwd.wallet, models })
    logger.warn(
      `incoming payment failed: ${message}`, {
        payInId: transitionedPayIn.id
      })
  }

  return transitionedPayIn
}

export async function payInHeld ({ data, models, lnd, boss, ...args }) {
  const { payInId } = data

  return await transitionPayIn('payInHeld', data, {
    payInId,
    fromStates: 'PENDING_HELD',
    toState: 'HELD',
    transitionFunc: async ({ tx, payIn, lndPayInBolt11 }) => {
      // XXX allow both held and confirmed invoices to do this transition
      // because it's possible for a prior settleHodlInvoice to have succeeded but
      // timeout and rollback the transaction, leaving the invoice in a pending_held state
      if (!(lndPayInBolt11.is_held || lndPayInBolt11.is_confirmed)) {
        throw new Error('invoice is not held')
      }

      if (payIn.payOutBolt11) {
        throw new Error('invoice is associated with a forward')
      }

      // make sure settled or cancelled in 60 seconds to minimize risk of force closures
      const expiresAt = new Date(Math.min(payIn.payInBolt11.expiresAt, datePivot(new Date(), { seconds: 60 })))
      boss.send('payInCancel', { payInId, payInFailureReason: 'HELD_INVOICE_SETTLED_TOO_SLOW' }, { startAfter: expiresAt, ...FINALIZE_OPTIONS })
        .catch(e => console.error('failed to finalize', e))

      // if this is a pessimistic action, we want to perform it now
      let pessimisticEnv
      if (payIn.pessimisticEnv) {
        pessimisticEnv = {
          update: {
            result: await onBegin(tx, payIn.id, payIn.pessimisticEnv.args)
          }
        }
      }

      // settle the invoice, allowing us to transition to PAID
      await settleHodlInvoice({ secret: payIn.payInBolt11.preimage, lnd })

      return {
        payInBolt11: {
          update: {
            msatsReceived: BigInt(lndPayInBolt11.received_mtokens)
          }
        },
        pessimisticEnv
      }
    },
    cancelOnError: true
  }, { models, lnd, boss, ...args })
}

export async function payInCancel ({ data, models, lnd, boss, ...args }) {
  const { payInId, payInFailureReason } = data
  const transitionedPayIn = await transitionPayIn('payInCancel', data, {
    payInId,
    fromStates: ['HELD', 'PENDING', 'PENDING_HELD', 'FAILED_FORWARD'],
    toState: 'CANCELLED',
    transitionFunc: async ({ tx, payIn, lndPayInBolt11 }) => {
      if (lndPayInBolt11.is_confirmed) {
        throw new Error('invoice is confirmed already')
      }

      await cancelHodlInvoice({ id: payIn.payInBolt11.hash, lnd })

      // transition to FAILED manually so we don't have to wait
      await tx.$executeRaw`
        INSERT INTO pgboss.job (name, data, priority)
        VALUES ('payInFailed', jsonb_build_object('payInId', ${payInId}::INTEGER), 100)`

      return {
        payInFailureReason: payInFailureReason ?? 'SYSTEM_CANCELLED'
      }
    }
  }, { models, lnd, boss, ...args })

  if (transitionedPayIn) {
    if (transitionedPayIn.payOutBolt11) {
      const { wallet, bolt11 } = transitionedPayIn.payOutBolt11
      const logger = walletLogger({ wallet, models })
      const decoded = await parsePaymentRequest({ request: bolt11 })
      logger.info(
        `invoice for ${formatSats(msatsToSats(decoded.mtokens))} canceled by payer`, {
          bolt11,
          payInId: transitionedPayIn.id
        })
    }
  }

  return transitionedPayIn
}

export async function payInFailed ({ data, models, lnd, boss, ...args }) {
  const { payInId, payInFailureReason } = data
  return await transitionPayIn('payInFailed', data, {
    payInId,
    // any of these states can transition to FAILED
    fromStates: ['PENDING', 'PENDING_HELD', 'HELD', 'FAILED_FORWARD', 'CANCELLED', 'PENDING_INVOICE_CREATION', 'PENDING_INVOICE_WRAP'],
    toState: 'FAILED',
    transitionFunc: async ({ tx, payIn, lndPayInBolt11 }) => {
      let payInBolt11
      if (lndPayInBolt11) {
        if (!lndPayInBolt11.is_canceled) {
          throw new Error('invoice is not cancelled')
        }
        payInBolt11 = {
          update: {
            cancelledAt: new Date()
          }
        }
      }

      await onFail(tx, payIn.id)

      // TODO: in which cases might we not have this passed by can deduce the error from the payIn/lnd state?
      const reason = payInFailureReason ?? payIn.payInFailureReason ?? 'UNKNOWN_FAILURE'

      return {
        payInFailureReason: reason,
        payInBolt11
      }
    }
  }, { models, lnd, boss, ...args })
}
