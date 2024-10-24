import { createHodlInvoice as lndCreateHodlInvoice, createInvoice as lndCreateInvoice, parsePaymentRequest } from 'ln-service'
import { datePivot } from '@/lib/time'
import { PAID_ACTION_TERMINAL_STATES, USER_ID } from '@/lib/constants'
import { createHmac } from '../resolvers/wallet'
import { Prisma } from '@prisma/client'
import * as ITEM_CREATE from './itemCreate'
import * as ITEM_UPDATE from './itemUpdate'
import * as ZAP from './zap'
import * as DOWN_ZAP from './downZap'
import * as POLL_VOTE from './pollVote'
import * as TERRITORY_CREATE from './territoryCreate'
import * as TERRITORY_UPDATE from './territoryUpdate'
import * as TERRITORY_BILLING from './territoryBilling'
import * as TERRITORY_UNARCHIVE from './territoryUnarchive'
import * as DONATE from './donate'
import * as BOOST from './boost'
import { listWallets as listUserWallets, createWrappedInvoice as createUserWrappedInvoice } from 'wallets/server'

const INVOICE_EXPIRE_SECS = 600
const MAX_PENDING_PAID_ACTIONS_PER_USER = 100
/* debug */ // TODO: remove
const FAIL_P2P = true
const FAIL_SN = false
const FAIL_CC = false
/* debug */

export const paidActions = {
  ITEM_CREATE,
  ITEM_UPDATE,
  ZAP,
  DOWN_ZAP,
  BOOST,
  POLL_VOTE,
  TERRITORY_CREATE,
  TERRITORY_UPDATE,
  TERRITORY_BILLING,
  TERRITORY_UNARCHIVE,
  DONATE
}

/**
 *
 * 1. user performPaidAction with forceFeeCredits = false
 * 2. performPaidAction will try to create a lightning invoice using an attached wallet
 * 3. if no wallet is attached, it will create a CC invoice payable by the user via lightning
 *
 * if the user fails to pay the invoice, the user can use performPaidAction again with forceFeeCredits = true
 * this will attempt to pay using the fee credit instead
 *
 * @param {*} actionType
 * @param {*} args
 * @param {*} context
 * @param {*} walletOffset
 * @returns
 */
export default async function performPaidAction (actionType, args, context) {
  try {
    const paidAction = paidActions[actionType]
    if (!paidAction) {
      throw new Error(`Invalid action type ${actionType}`)
    }
    context.me = context.me ? await context.models.user.findUnique({ where: { id: context.me.id } }) : undefined
    context.cost = context.cost ?? await paidAction.getCost(args, context)

    const { me, forceFeeCredits, cost } = context
    let canPerformOptimistically = paidAction.supportsOptimism
    const canPerformPessimistically = paidAction.supportsPessimism ?? true

    if (!canPerformOptimistically && !canPerformPessimistically) throw new Error('Action is ambiguous. Does not support optimistic or pessimistic execution')

    if (!me) {
      if (!paidAction.anonable) {
        throw new Error('You must be logged in to perform this action')
      }

      if (cost > 0) {
        console.log('we are anon so can only perform pessimistic action that require payment')
        canPerformOptimistically = false
      }
    }
    console.log(forceFeeCredits)
    if (forceFeeCredits) return performFeeCreditAction(actionType, paidAction, args, context)

    const receiverUserId = await paidAction.invoiceablePeer?.(args, context) // falsy if SN itself
    const description = await paidAction.describe(args, context)
    const { invoice, canRetry } = await createInvoice(receiverUserId, cost, description, canPerformOptimistically, context)

    if (canPerformOptimistically) return await performOptimisticAction(invoice, actionType, paidAction, args, context, canRetry)
    return await performPessimisticAction(invoice, actionType, paidAction, args, context, canRetry)
  } catch (e) {
    console.error('performPaidAction failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}

async function performAction (invoice, paidAction, args, context) {
  const { retryForInvoice } = context
  if (retryForInvoice && paidAction.retry) {
    return await paidAction.retry({ invoiceId: retryForInvoice.id, newInvoiceId: invoice?.id }, context)
  } else {
    return await paidAction.perform?.({ invoiceId: invoice?.id, ...args }, context)
  }
}

async function performOptimisticAction (invoice, actionType, paidAction, args, context, canRetry) {
  const { models, walletOffset } = context
  const performInvoicedAction = async tx => {
    context.tx = tx
    context.optimistic = true
    const invoiceEntry = await createDbInvoice(actionType, args, context, invoice, walletOffset)
    return {
      invoice: invoiceEntry,
      result: await performAction(invoiceEntry, paidAction, args, context),
      paymentMethod: 'OPTIMISTIC',
      canRetry
    }
  }
  if (context.tx) return await performInvoicedAction(context.tx)
  return await models.$transaction(performInvoicedAction, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

async function performPessimisticAction (invoice, actionType, paidAction, args, context, canRetry) {
  const { models, walletOffset } = context
  const performInvoicedAction = async tx => {
    context.tx = tx
    context.optimistic = false
    const invoiceEntry = await createDbInvoice(actionType, args, context, invoice, walletOffset)
    return {
      invoice: invoiceEntry,
      paymentMethod: 'PESSIMISTIC',
      canRetry
    }
  }
  if (context.tx) return await performInvoicedAction(context.tx)
  return await models.$transaction(performInvoicedAction, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

async function performFeeCreditAction (actionType, paidAction, args, context) {
  const { me, models, cost, retryForInvoice } = context
  if (FAIL_CC) throw new Error('CC failed (debug)')
  if (cost > (me?.msats ?? 0)) {
    throw new Error('forceFeeCredits is set, but user does not have enough fee credits ' + me?.msats + ' < ' + cost)
  }

  const run = async tx => {
    context.tx = tx

    try {
      console.log('enough fee credits available, performing fee credit action')
      await tx.user.update({
        where: {
          id: me?.id ?? USER_ID.anon
        },
        data: {
          msats: {
            decrement: cost
          }
        }
      })
      console.log('Paid action with fee credits')
      const invoiceData = await createDbInvoice(actionType, args, context, { actionState: 'PAID' })
      const result = await performAction(invoiceData, paidAction, args, context)
      console.log('Result', result)
      await paidAction.onPaid?.({ ...result, invoice: invoiceData }, context)

      return {
        result,
        paymentMethod: 'FEE_CREDIT',
        canRetry: false
      }
    } catch (e) {
      console.error('fee credit action failed', e)
      if (retryForInvoice) {
        await tx.invoice.update({
          where: {
            id: retryForInvoice.id
          },
          data: {
            actionState: 'FAILED'
          }
        })
      }
      // if we fail with fee credits, but not because of insufficient funds, bail
      // if (!e.message.includes('\\"users\\" violates check constraint \\"msats_positive\\"')) {
      throw e
      // }
    }
  }
  const result = context.tx
    ? await run(context.tx)
    : await models.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

  // run non critical side effects in the background
  // after the transaction has been committed
  paidAction.nonCriticalSideEffects?.(result.result, context).catch(console.error)
}

export async function retryPaidAction (actionType, { invoice, forceFeeCredits }, context) {
  const { models } = context
  const failedInvoice = invoice

  console.log('retryPaidAction', actionType, invoice)

  const action = paidActions[actionType]
  if (!action) {
    throw new Error(`retryPaidAction - invalid action type ${actionType}`)
  }

  if (!failedInvoice) {
    throw new Error(`retryPaidAction - missing invoice ${actionType}`)
  }

  const { msatsRequested, actionId, actionArgs } = failedInvoice
  context.cost = BigInt(msatsRequested)
  context.actionId = actionId
  context.retryForInvoice = failedInvoice
  context.forceFeeCredits = forceFeeCredits
  // we cycle through the wallets to have a better chance of success (nb. last wallet is always sn CC if withFallbackToCC=true)
  context.walletOffset = (failedInvoice.walletOffset ?? 0) + 1

  console.log('use wallet offset', context.walletOffset)

  const paidAction = paidActions[actionType]
  const supportRetrying = paidAction.retry

  return await models.$transaction(async tx => {
    context.tx = tx

    if (supportRetrying) {
      // update the old invoice to RETRYING, so that it's not confused with FAILED
      await tx.invoice.update({
        where: {
          id: failedInvoice.id,
          actionState: 'FAILED'
        },
        data: {
          actionState: 'RETRYING'
        }
      })
    }
    return await performPaidAction(actionType, actionArgs, context)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

async function createInvoice (receiverUserId, cost, description, isOptimistic, context) {
  const { models, walletOffset } = context
  let invoice
  let sourceUserWallets
  let canRetry = false
  try {
    if (FAIL_P2P) throw new Error('P2P failed (debug)')
    sourceUserWallets = receiverUserId ? await listUserWallets(models, receiverUserId) : []
    canRetry = walletOffset < sourceUserWallets.length

    // cycle through wallets
    for (let i = 0; i < sourceUserWallets.length; i++) {
      const j = ((walletOffset ?? 0) + i) % sourceUserWallets.length

      const sourceWallet = sourceUserWallets[j]
      console.log(sourceUserWallets, j, sourceWallet)
      try {
        invoice = await createUserLightningInvoice(sourceWallet, receiverUserId, cost, description, context)
        if (invoice) {
          console.info('created invoice', invoice)
          break
        } else {
          console.error('failed to create invoice ??? proceed with next available wallet')
        }
      } catch (e) {
        console.error('failed to create invoice', e, 'proceed with next available wallet')
      }
    }
  } catch (e) {
    console.error('failed to create invoice', e)
  }

  if (!invoice) {
    try {
      if (FAIL_SN) throw new Error('SN failed (debug)')
      console.info('Create SM invoice', receiverUserId)
      invoice = await createSNLightningInvoice(cost, description, isOptimistic, context)
      canRetry = false
    } catch (e) {
      console.error('failed to create SM invoice', e)
    }
  }
  if (!invoice) throw new Error('failed to create invoice') // how did you even get here?

  return { invoice, canRetry }
}

async function createUserLightningInvoice (
  senderWallet,
  receiverId,
  cost,
  description,
  { models, lnd, me }
) {
  if (!senderWallet) throw new Error('senderWallet is required')
  if (!receiverId) throw new Error('receiverId is required')
  if (!description) throw new Error('description is required')

  // if the action has an invoiceable peer, we'll create a peer invoice
  // wrap it, and return the wrapped invoice

  // count pending invoices and bail if we're over the limit
  const pendingInvoices = await models.invoice.count({
    where: {
      userId: me?.id ?? USER_ID.anon,
      actionState: {
        // not in a terminal state. Note: null isn't counted by prisma
        notIn: PAID_ACTION_TERMINAL_STATES
      }
    }
  })

  console.log('pending paid actions', pendingInvoices)
  if (pendingInvoices >= MAX_PENDING_PAID_ACTIONS_PER_USER) {
    throw new Error('You have too many pending paid actions, cancel some or wait for them to expire')
  }

  const { invoice: bolt11, wallet, wrappedInvoice, maxFee } = await createUserWrappedInvoice(senderWallet, receiverId, {
    // this is the amount the stacker will receive, the other 3/10ths is the sybil fee
    msats: cost * BigInt(7) / BigInt(10),
    description,
    expiry: INVOICE_EXPIRE_SECS,
    wrappedMsats: cost
  }, {
    models,
    lnd
  })
  return {
    bolt11,
    wrappedBolt11: wrappedInvoice.request,
    wallet, // if wallet is not set = CC wallet
    maxFee
  }
}

// we seperate the invoice creation into two functions because
// because if lnd is slow, it'll timeout the interactive tx
async function createSNLightningInvoice (
  cost,
  description,
  isOptimistic,
  { lnd, me }
) {
  const createLNDInvoice = isOptimistic ? lndCreateInvoice : lndCreateHodlInvoice

  if (cost < 1000n) {
    // sanity check
    throw new Error('The cost of the action must be at least 1 sat')
  }

  const expiresAt = datePivot(new Date(), { seconds: INVOICE_EXPIRE_SECS })
  const invoice = await createLNDInvoice({
    description: me?.hideInvoiceDesc ? undefined : description,
    lnd,
    mtokens: String(cost),
    expires_at: expiresAt
  })
  return { bolt11: invoice.request, preimage: invoice.secret }
}

async function createDbInvoice (actionType, args, context,
  { bolt11, wrappedBolt11, preimage, wallet, maxFee, actionState }) {
  const { me, models, tx, cost, optimistic, actionId, walletOffset } = context
  const db = tx ?? models

  if (cost < 1000n) {
    // sanity check
    throw new Error('The cost of the action must be at least 1 sat')
  }

  const servedBolt11 = wrappedBolt11 ?? bolt11
  const servedInvoice = servedBolt11
    ? parsePaymentRequest({ request: servedBolt11 })
    : {
      // TODO generate better random ID
        id: 'CC' + Math.random().toString(36).substring(2, 15),
        mtokens: cost,
        expires_at: Math.floor(Date.now() / 1000) + INVOICE_EXPIRE_SECS
      }
  const expiresAt = new Date(servedInvoice.expires_at)

  const invoiceData = {
    hash: servedInvoice.id,
    msatsRequested: BigInt(servedInvoice.mtokens),
    preimage,
    bolt11: servedBolt11 ?? '',
    userId: me?.id ?? USER_ID.anon,
    actionType,
    actionState: actionState ?? (wrappedBolt11 ? 'PENDING_HELD' : optimistic ? 'PENDING' : 'PENDING_HELD'),
    actionOptimistic: optimistic,
    actionArgs: args,
    expiresAt,
    actionId,
    walletOffset: walletOffset ?? 0
  }

  let invoice
  if (wrappedBolt11) {
    invoice = (await db.invoiceForward.create({
      include: { invoice: true },
      data: {
        bolt11,
        maxFeeMsats: maxFee,
        invoice: {
          create: invoiceData
        },
        wallet: {
          connect: {
            id: wallet.id
          }
        }
      }
    })).invoice
  } else {
    invoice = await db.invoice.create({ data: invoiceData })
  }

  // insert a job to check the invoice after it's set to expire
  await db.$executeRaw`
      INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, expirein, priority)
      VALUES ('checkInvoice',
        jsonb_build_object('hash', ${invoice.hash}::TEXT), 21, true,
          ${expiresAt}::TIMESTAMP WITH TIME ZONE,
          ${expiresAt}::TIMESTAMP WITH TIME ZONE - now() + interval '10m', 100)`

  // the HMAC is only returned during invoice creation
  // this makes sure that only the person who created this invoice
  // has access to the HMAC
  invoice.hmac = createHmac(invoice.hash)

  return invoice
}
