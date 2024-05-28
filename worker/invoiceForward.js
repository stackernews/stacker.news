import {
  payViaPaymentRequest,
  parsePaymentRequest,
  settleHodlInvoice,
  cancelHodlInvoice
} from 'ln-service'
import { hodlInvoiceCltvDetails } from '@/api/lnd'
import { MIN_SETTLEMENT_CLTV_DELTA } from '@/api/createInvoice/wrap'
import serialize from '@/api/resolvers/serial'
import { Prisma } from '@prisma/client'
import { datePivot } from '@/lib/time'

/*

Possible state transitions for an invoiceForward:
CREATED -> HELD
CREATED -> CANCELLED
HELD -> FORWARD_PENDING
HELD -> CANCELLED
FORWARD_PENDING -> FORWARD_FAILED
FORWARD_PENDING -> FORWARD_CONFIRMED
FORWARD_FAILED -> CANCELLED
FORWARD_CONFIRMED -> SETTLED
SETTLED -> CONFIRMED

One problem we face is that multiple workers are running at the same time and for some state
transitions, we need to make sure that only one worker is able to perform the action.
We solve this by letting a state transition happen only once and whoever gets there first
gets to perform the transition and the effects of the transition.

Things we definitely don't want to do:
1. cancel an incoming payment that has a forward in progress
2. forward an incoming payment that has been cancelled
3. forward an incoming payment more than once (lnd will reject the payment, but we should prevent this too)
4. miss settling an incoming payment that has been successfully forwarded
5. miss applying effects of a successful forward

Test cases:
1. outgoing payment is held indefinitely

Things we should avoid:
1. holding an incoming payment that has failed to forward

Things we should consider doing in the future:
1. retrying a failed forward a couple of times before cancelling the payment

*/

export async function checkInvoiceForwardIncoming (invoiceForward, context) {
  const { invoice, models, boss } = context
  console.log(`checking incoming invoiceForward ${invoiceForward.id} with invoice ${invoice.id} in state ${invoiceForward.status}`)

  if (invoice.is_held) {
    try {
      const { expiryHeight, acceptHeight } = hodlInvoiceCltvDetails(invoice)
      await createdToHeld(invoiceForward, context, { expiryHeight, acceptHeight })
      if (expiryHeight - acceptHeight < MIN_SETTLEMENT_CLTV_DELTA) {
        await heldToCancelled(invoiceForward, context)
      } else {
        const bolt11 = await parsePaymentRequest({ request: invoiceForward.bolt11 })
        await heldToForwardPending(invoiceForward, context, { expiryHeight, acceptHeight, msats: BigInt(bolt11.mtokens) })
      }
    } catch (error) {
      // attempt to cancel if we failed to transition to FORWARD_PENDING
      await createdToCancelled(invoiceForward, context) ||
        await heldToCancelled(invoiceForward, context)
    }
    return
  }

  if (invoice.is_confirmed) {
    try {
      await settledToConfirmed(invoiceForward, context)
    } catch (error) {
      // if we failed to transition to SUCCESSFUL, we need to retry until we succeed
      await boss.send('checkInvoice', { hash: invoice.id }, { startAfter: datePivot(new Date(), { minutes: 1 }) })
    }
    return
  }

  if (invoice.is_canceled) {
    // if the invoice is cancelled, we should try to transition to CANCELLED any way we can
    await createdToCancelled(invoiceForward, context) ||
      await heldToCancelled(invoiceForward, context) ||
      await forwardFailedToCancelled(invoiceForward, context)
    await serialize(
      models.invoice.update({
        where: {
          hash: invoice.id
        },
        data: {
          cancelled: true
        }
      }), { models }
    )
  }
}

export async function checkInvoiceForwardOutgoing (invoiceForward, context) {
  const { withdrawal, boss } = context
  console.log(`checking outgoing invoiceForward ${invoiceForward.id} with withdrawal ${withdrawal.id} in state ${invoiceForward.status}`)

  if (withdrawal.is_failed) {
    let status = 'UNKNOWN_FAILURE'
    if (withdrawal?.failed.is_insufficient_balance) {
      status = 'INSUFFICIENT_BALANCE'
    } else if (withdrawal?.failed.is_invalid_payment) {
      status = 'INVALID_PAYMENT'
    } else if (withdrawal?.failed.is_pathfinding_timeout) {
      status = 'PATHFINDING_TIMEOUT'
    } else if (withdrawal?.failed.is_route_not_found) {
      status = 'ROUTE_NOT_FOUND'
    }

    await forwardPendingToForwardFailed(invoiceForward, context, { status })
    await forwardFailedToCancelled(invoiceForward, context)
  }

  if (withdrawal.is_confirmed) {
    try {
      await forwardPendingToForwardConfirmed(invoiceForward, context)
      await forwardConfirmedToSettled(invoiceForward, context)
    } catch (error) {
      // if we failed to transition to SETTLED, we need to retry until we succeed
      await boss.send('checkWithdrawal', { hash: invoiceForward.withdrawl.hash }, { startAfter: datePivot(new Date(), { minutes: 1 }), priority: 1000 })
    }
  }
}

async function transition (func) {
  try {
    await func()
    return true
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // this error is thrown when we try to update a record that has been updated by another worker
      // so we just ignore it and let the other worker take the transition "lock" and perform the transition
      if (e.code === 'P2025') {
        return false
      }
    }
    console.error('unexpected error transitioning', e)
    throw e
  }
}

async function createdToHeld (invoiceForward, { models }, { acceptHeight, expiryHeight } = {}) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from CREATED to HELD`)
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'CREATED'
        },
        data: {
          status: 'HELD',
          acceptHeight,
          expiryHeight,
          invoice: {
            update: {
              isHeld: true
            }
          }
        }
      })
    ], { models })
  })
}

async function createdToCancelled (invoiceForward, { invoice, models, lnd }) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from CREATED to CANCELLED`)
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'CREATED'
        },
        data: {
          status: 'CANCELLED'
        }
      })
    ], { models })
    await cancelHodlInvoice({ id: invoice.id, lnd })
  })
}

async function heldToCancelled (invoiceForward, { invoice, models, lnd }) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from HELD to CANCELLED`)
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'HELD'
        },
        data: {
          status: 'CANCELLED'
        }
      })
    ], { models })
    await cancelHodlInvoice({ id: invoice.id, lnd })
  })
}

async function heldToForwardPending (invoiceForward, { invoice, models, lnd }, { acceptHeight, expiryHeight, msats }) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from CREATED to FORWARD_PENDING`)
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'HELD'
        },
        data: {
          status: 'FORWARD_PENDING',
          withdrawl: {
            create: {
              hash: invoice.id,
              bolt11: invoiceForward.bolt11,
              msatsPaying: msats,
              msatsFeePaying: invoiceForward.maxFeeMsats,
              autoWithdraw: true,
              walletId: invoiceForward.walletId,
              userId: invoiceForward.wallet.userId
            }
          }
        }
      })], { models })

    payViaPaymentRequest({
      lnd,
      request: invoiceForward.bolt11,
      max_fee_mtokens: String(invoiceForward.maxFeeMsats),
      pathfinding_timeout: 30000,
      max_timeout_height: expiryHeight - acceptHeight - MIN_SETTLEMENT_CLTV_DELTA
    }).catch(console.error)
  })
}

async function forwardPendingToForwardFailed (invoiceForward, { models, lnd }, { status }) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from FORWARD_PENDING to FORWARD_FAILED`)
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'FORWARD_PENDING'
        },
        data: {
          status: 'FORWARD_FAILED',
          withdrawl: {
            update: {
              status
            }
          }
        }
      })
    ], { models })
  })
}

async function forwardFailedToCancelled (invoiceForward, { models, lnd }) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from FORWARD_FAILED to CANCELLED`)
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'FORWARD_FAILED'
        },
        data: {
          status: 'CANCELLED'
        }
      })
    ], { models })
    await cancelHodlInvoice({ id: invoiceForward.invoice.hash, lnd })
  })
}

async function forwardPendingToForwardConfirmed (invoiceForward, { withdrawal: { payment }, models, lnd }) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from FORWARD_PENDING to FORWARD_CONFIRMED`)
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'FORWARD_PENDING'
        },
        data: {
          status: 'FORWARD_CONFIRMED',
          withdrawl: {
            update: {
              status: 'CONFIRMED',
              msatsPaid: BigInt(payment.mtokens),
              msatsFeePaid: BigInt(payment.fee_mtokens),
              preimage: payment.secret
            }
          }
        }
      })
    ], { models })
  })
}

async function forwardConfirmedToSettled (invoiceForward, { withdrawal: { payment }, models, lnd }) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from FORWARD_CONFIRMED to SETTLED`)
  return await transition(async () => {
    // make settling dependent on the payment being settled
    await settleHodlInvoice({ secret: payment.secret, lnd })
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'FORWARD_CONFIRMED'
        },
        data: {
          status: 'SETTLED'
        }
      })
    ], { models })
  })
}

async function settledToConfirmed (invoiceForward, { invoice, models }) {
  console.log(`transitioning invoiceForward ${invoiceForward.id} from SETTLED to CONFIRMED`)
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'SETTLED'
        },
        data: {
          status: 'CONFIRMED',
          invoice: {
            update: {
              confirmedAt: new Date(invoice.confirmed_at),
              confirmedIndex: invoice.confirmed_index,
              msatsReceived: BigInt(invoice.received_mtokens)
            }
          }
        }
      })
    ], { models })
    /*
      TODO perform any other actions that need to be done when an invoiceForward is successful
      1. marking any dependent actions as paid
      2. performing side effects of those actions (e.g. ranking, denomormalization, etc.)
      3. sending notifications

      1 & 2 should be done transactionally with the update above
      3 should be done if the transaction is successful
    */
  })
}
