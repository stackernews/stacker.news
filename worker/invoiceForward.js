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
HELD -> FORWARDED
HELD -> CANCELLED
FORWARDED -> FORWARD_FAILED
FORWARDED -> FORWARD_CONFIRMED
FORWARD_FAILED -> CANCELLED
FORWARD_CONFIRMED -> SETTLED
SETTLED -> SUCCESSFUL

One problem we face is that multiple workers are running at the same time and for some state
transitions, we need to make sure that only one worker is able to perform the action.
We solve this by letting a state transition happen only once and whoever gets there first
gets to perform the effects of the transition.

Things we definitely don't want to do:
1. cancel an incoming payment that has a forward in progress
2. forward an incoming payment that has been cancelled
3. forward an incoming payment more than once (lnd will reject the payment, but we should prevent this too)
4. miss settling an incoming payment that has been successfully forwarded
5. miss applying effects of a successful forward

Things we should avoid:
1. holding an incoming payment that has failed to forward

Things we should consider doing in the future:
1. retrying a failed forward a couple of times before cancelling the payment

*/

async function transition (func) {
  try {
    await func()
    return true
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        return false
      }
    }
    throw e
  }
}

async function createdToHeld ({ invoiceForward }, { models }) {
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'CREATED'
        },
        data: {
          status: 'HELD',
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

async function createdToCancelled ({ inv, invoiceForward }, { models, lnd }) {
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
    await cancelHodlInvoice({ id: inv.id, lnd })
  })
}

async function heldToCancelled ({ invoiceForward, inv, acceptHeight, expiryHeight }, { models, lnd }) {
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'HELD'
        },
        data: {
          status: 'CANCELLED',
          acceptHeight,
          expiryHeight
        }
      })
    ], { models })
    await cancelHodlInvoice({ id: inv.id, lnd })
  })
}

async function heldToFowarded ({ invoiceForward, inv, acceptHeight, expiryHeight, msats }, { models, lnd }) {
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'HELD'
        },
        data: {
          status: 'FORWARDED',
          withdrawl: {
            create: {
              hash: inv.id,
              bolt11: invoiceForward.bolt11,
              msats,
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

async function forwardedToForwardFailed ({ invoiceForward, status }, { models, lnd }) {
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'FORWARDED'
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

async function forwardFailedToCancelled ({ invoiceForward }, { models, lnd }) {
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

async function forwardToForwardConfirmed ({ invoiceForward, payment }, { models, lnd }) {
  return await transition(async () => {
    // make confirmation dependent on the payment being settled
    await settleHodlInvoice({ secret: payment.secret, lnd })
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'FORWARDED'
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

async function forwardConfirmedToSettled ({ invoiceForward, payment }, { models, lnd }) {
  return await transition(async () => {
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

async function settledToSuccessful ({ invoiceForward, inv }, { models }) {
  return await transition(async () => {
    await serialize([
      models.invoiceForward.update({
        where: {
          id: invoiceForward.id,
          status: 'SETTLED'
        },
        data: {
          status: 'SUCCESSFUL',
          invoice: {
            confirmedAt: new Date(inv.confirmed_at),
            confirmedIndex: inv.confirmed_index,
            msatsReceived: BigInt(inv.received_mtokens)
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

export async function checkInvoiceForwardIncoming ({ inv, invoiceForward, boss, models, lnd }) {
  if (inv.is_held) {
    try {
      await createdToHeld({ invoiceForward }, { models })
      const { expiryHeight, acceptHeight } = hodlInvoiceCltvDetails(inv)
      if (expiryHeight - acceptHeight < MIN_SETTLEMENT_CLTV_DELTA) {
        await heldToCancelled({ inv, invoiceForward, expiryHeight, acceptHeight }, { models, lnd })
      } else {
        const bolt11 = await parsePaymentRequest({ request: invoiceForward.bolt11 })
        await heldToFowarded({ inv, invoiceForward, expiryHeight, acceptHeight, msats: BigInt(bolt11.mtokens) }, { models, lnd })
      }
    } catch (error) {
      // attempt to cancel if we failed to transition to FORWARDED
      await createdToCancelled({ inv, invoiceForward }, { models, lnd })
      await heldToCancelled({ inv, invoiceForward }, { models, lnd })
    }
  }

  if (inv.is_confirmed) {
    try {
      await settledToSuccessful({ invoiceForward, inv }, { models })
    } catch (error) {
      // if we failed to transition to SUCCESSFUL, we need to retry until we succeed
      await boss.send('checkInvoice', { hash: inv.id }, { startAfter: datePivot(new Date(), { minutes: 1 }) })
    }
  }

  // TODO: handle cancelled invoices
}

export async function checkInvoiceForwardOutgoing ({ payment, invoiceForward, boss, models, lnd }) {
  if (payment.is_failed) {
    let status = 'UNKNOWN_FAILURE'
    if (payment?.failed.is_insufficient_balance) {
      status = 'INSUFFICIENT_BALANCE'
    } else if (payment?.failed.is_invalid_payment) {
      status = 'INVALID_PAYMENT'
    } else if (payment?.failed.is_pathfinding_timeout) {
      status = 'PATHFINDING_TIMEOUT'
    } else if (payment?.failed.is_route_not_found) {
      status = 'ROUTE_NOT_FOUND'
    }

    await forwardedToForwardFailed({ invoiceForward, status }, { models, lnd })
    await forwardFailedToCancelled({ invoiceForward }, { models, lnd })
  }

  if (payment.is_confirmed) {
    try {
      await forwardToForwardConfirmed({ invoiceForward, payment }, { models })
      await forwardConfirmedToSettled({ invoiceForward, payment }, { models, lnd })
    } catch (error) {
      console.log('error settling forward', error)
      // if we failed to transition to SETTLED, we need to retry until we succeed
      await boss.send('checkWithdrawal', { hash: invoiceForward.withdrawl.hash }, { startAfter: datePivot(new Date(), { minutes: 1 }), priority: 1000 })
    }
  }
}
