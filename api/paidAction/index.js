import { createHodlInvoice, createInvoice, parsePaymentRequest } from 'ln-service'
import { datePivot } from '@/lib/time'
import { PAID_ACTION_PAYMENT_METHODS, PAID_ACTION_TERMINAL_STATES, USER_ID } from '@/lib/constants'
import { createHmac } from '@/api/resolvers/wallet'
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
import { createWrappedInvoice } from 'wallets/server'

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

export default async function performPaidAction (actionType, args, { ...context }) {
  try {
    const { models } = context
    const paidAction = paidActions[actionType]

    console.group('performPaidAction', actionType, args)

    if (!paidAction) {
      throw new Error(`Invalid action type ${actionType}`)
    }

    // add context properties
    context.me = context.me ? await models.user.findUnique({ where: { id: context.me.id } }) : undefined
    context.cost = await paidAction.getCost(args, context)
    context.sybilFeePercent = await paidAction.getSybilFeePercent?.(args, context)
    context.attempt = context.attempt ?? 0 // how many times the client thinks it has tried
    context.forceInternal = context.forceInternal ?? false // use only internal payment methods
    context.prioritizeInternal = context.prioritizeInternal ?? false // prefer internal payment methods
    context.description = context.me?.hideInvoiceDesc ? undefined : await paidAction.describe?.(args, context)
    context.descriptionHash = await paidAction.describeHash?.(args, context)
    context.supportedPaymentMethods = paidAction.paymentMethods ?? await paidAction.getPaymentMethods?.(args, context) ?? []

    const {
      me,
      forceInternal,
      cost,
      prioritizeInternal
    } = context

    if (!me && !paidAction.anonable) { // action is not allowed for anons
      throw new Error('You must be logged in to perform this action')
    }

    if (cost === 0n) { // special case for zero cost actions
      console.log('performing zero cost action')
      return await performNoInvoiceAction(actionType, args, { ...context, paymentMethod: PAID_ACTION_PAYMENT_METHODS.ZERO_COST })
    }

    // sort and filter supported payment methods
    if (forceInternal) {
      //  we keep only the payment methods that qualify as internal payments
      if (!me) {
        throw new Error('user must be logged in to use internal payments')
      }
      const forcedPaymentMethods = []
      // reset the supported payment methods to only include internal methods
      // that are supported by the action
      if (context.supportedPaymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT)) {
        forcedPaymentMethods.push(PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT)
      }
      // TODO: add reward sats
      // ...
      if (forcedPaymentMethods.length === 0) {
        throw new Error('action does not support internal payments')
      }
      context.supportedPaymentMethods = forcedPaymentMethods
    } else if (prioritizeInternal) {
      // prefer internal payment methods over the others (if they are supported)
      const priority = {
        [PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT]: -2
        // add other internal methods here
      }
      context.supportedPaymentMethods = context.supportedPaymentMethods.sort((a, b) => {
        return priority[a] - priority[b]
      })
    }

    const { supportedPaymentMethods } = context

    for (const paymentMethod of supportedPaymentMethods) {
      console.log(`trying payment method ${paymentMethod}`)

      if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.P2P) {
        try {
          return await performP2PAction(actionType, args, context, paymentMethod)
        } catch (e) {
          // p2p can fail for various reasons, if it does, we should try another payment method
          console.error('paid action failed with P2P payment method, try another one', e)
          continue
        }
      }

      try {
        switch (paymentMethod) {
          case PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT: {
            if (!me || (me.msats ?? 0n) < cost) break // if anon or low balance skip
            return await performNoInvoiceAction(actionType, args, { ...context, paymentMethod })
          }
          // TODO: add reward sats
          // ...
          case PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC: {
            if (!me) break // anons are not optimistic
            return await performOptimisticAction(actionType, args, context)
          }
          case PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC: {
            return await beginPessimisticAction(actionType, args, context)
          }
        }
      } catch (e) {
        console.error('performPaidAction failed with internal payment method', e)
        // if we fail for reasons unrelated to balance, we should throw to fail the action
        if (!e.message.includes('\\"users\\" violates check constraint \\"msats_positive\\"')) {
          throw e
        }
      }
    }

    // if we reach this point, no payment method succeeded
    throw new Error('no payment method succeeded')
  } finally {
    console.groupEnd()
  }
}

async function performNoInvoiceAction (actionType, args, { ...context }) {
  const { me, models, cost, paymentMethod } = context
  const action = paidActions[actionType]

  const run = async tx => {
    context.tx = tx

    if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT) {
      await tx.user.update({
        where: {
          id: me?.id ?? USER_ID.anon
        },
        data: { msats: { decrement: cost } }
      })
    } // add other internal methods here

    const result = await performAction(null, action, args, context)
    await action.onPaid?.(result, context)

    return {
      result,
      paymentMethod,
      retriable: false
    }
  }
  // if this is nested into another transaction (eg for retryPaidAction), use the parent transaction
  const result = context.tx ? await run(context.tx) : await models.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
  // run non critical side effects in the background
  // after the transaction has been committed
  action.nonCriticalSideEffects?.(result.result, context).catch(console.error)
  return result
}

async function performOptimisticAction (actionType, args, { ...context }) {
  const { models } = context
  const action = paidActions[actionType]

  context.optimistic = true
  // create the invoice and perform the action immediately( invoiceArgs could be passed in by the p2p method)
  const invoiceArgs = context.invoiceArgs ?? await createSNInvoice(context)

  const run = async tx => {
    context.tx = tx

    const invoice = await createDbInvoice(actionType, args, { ...context, invoiceArgs })
    const result = await performAction(invoice, action, args, context)
    return {
      invoice,
      result,
      paymentMethod: 'OPTIMISTIC',
      retriable: false
    }
  }

  // if this is nested into another transaction (eg for retryPaidAction), use the parent transaction
  return context.tx ? await run(context.tx) : await models.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

async function beginPessimisticAction (actionType, args, { ...context }) {
  // just create the invoice and complete action when it's paid (invoiceArgs could be passed in by the p2p method)
  const invoiceArgs = context.invoiceArgs ?? await createSNInvoice(context)
  return {
    invoice: await createDbInvoice(actionType, args, { ...context, invoiceArgs }),
    paymentMethod: 'PESSIMISTIC',
    retriable: false
  }
}

async function performP2PAction (actionType, args, { ...context }) {
  const { cost, models, lnd, sybilFeePercent, me, supportedPaymentMethods, description, descriptionHash, attempt } = context
  if (!sybilFeePercent) {
    throw new Error('sybil fee percent is not set for an invoiceable peer action')
  }

  const userId = await paidActions[actionType]?.getInvoiceablePeer?.(args, context)
  if (!userId) {
    throw new NonInvoiceablePeerError()
  }

  await assertBelowMaxPendingInvoices(context)

  // optimistic only if logged in and the action supports optimism
  const optimistic = (me && supportedPaymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC))

  const { invoice, wrappedInvoice, wallet, maxFee, retriable } = await createWrappedInvoice(userId, {
    msats: cost,
    feePercent: sybilFeePercent,
    description,
    descriptionHash,
    expiry: INVOICE_EXPIRE_SECS,
    skipWallets: attempt
  }, { models, me, lnd })

  context.invoiceArgs = {
    bolt11: invoice,
    wrappedBolt11: wrappedInvoice,
    wallet,
    maxFee
  }

  return {
    retriable,
    ...(optimistic
      ? await performOptimisticAction(actionType, args, context)
      : await beginPessimisticAction(actionType, args, context))
  }
}

export async function retryPaidAction ({ invoiceId, forceInternal, attempt, prioritizeInternal }, { ...context }) {
  const { models, me } = context

  const failedInvoice = await models.invoice.findUnique({ where: { id: invoiceId, userId: me?.id ?? USER_ID.anon } })

  if (!failedInvoice) {
    throw new Error('invoice not found')
  }

  if (failedInvoice.actionState !== 'FAILED') {
    // you should cancel the invoice before retrying the action!
    throw new Error(`actions is not in a retriable state: ${failedInvoice.actionState}`)
  }

  const actionType = failedInvoice.actionType

  const paidAction = paidActions[actionType]
  if (!paidAction) {
    throw new Error(`retryPaidAction - invalid action type ${actionType}`)
  }

  const { msatsRequested, actionId, actionArgs } = failedInvoice
  context.cost = msatsRequested
  context.actionId = actionId
  context.retryForInvoice = failedInvoice
  context.forceInternal = forceInternal
  context.attempt = attempt
  context.prioritizeInternal = prioritizeInternal

  return await models.$transaction(async tx => {
    const supportRetrying = paidAction.retry
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

const INVOICE_EXPIRE_SECS = 600
const MAX_PENDING_PAID_ACTIONS_PER_USER = 100

export async function assertBelowMaxPendingInvoices (context) {
  const { models, me } = context
  const pendingInvoices = await models.invoice.count({
    where: {
      userId: me?.id ?? USER_ID.anon,
      actionState: {
        notIn: PAID_ACTION_TERMINAL_STATES
      }
    }
  })

  if (pendingInvoices >= MAX_PENDING_PAID_ACTIONS_PER_USER) {
    throw new Error('You have too many pending paid actions, cancel some or wait for them to expire')
  }
}

export class NonInvoiceablePeerError extends Error {
  constructor () {
    super('non invoiceable peer')
    this.name = 'NonInvoiceablePeerError'
  }
}

// we seperate the invoice creation into two functions because
// because if lnd is slow, it'll timeout the interactive tx
async function createSNInvoice (context) {
  const { lnd, cost, optimistic, description, descriptionHash } = context

  const createLNDInvoice = optimistic ? createInvoice : createHodlInvoice

  if (cost < 1000n) {
    // sanity check
    throw new Error('The cost of the action must be at least 1 sat')
  }

  const expiresAt = datePivot(new Date(), { seconds: INVOICE_EXPIRE_SECS })
  const invoice = await createLNDInvoice({
    description,
    descriptionHash,
    lnd,
    mtokens: String(cost),
    expires_at: expiresAt
  })
  return { bolt11: invoice.request, preimage: invoice.secret }
}

async function createDbInvoice (actionType, args, context) {
  const { me, models, tx, cost, optimistic, actionId, invoiceArgs } = context
  const { bolt11, wrappedBolt11, preimage, wallet, maxFee } = invoiceArgs

  const db = tx ?? models

  if (cost < 1000n) {
    // sanity check
    throw new Error('The cost of the action must be at least 1 sat')
  }

  const servedBolt11 = wrappedBolt11 ?? bolt11
  const servedInvoice = parsePaymentRequest({ request: servedBolt11 })
  const expiresAt = new Date(servedInvoice.expires_at)

  const invoiceData = {
    hash: servedInvoice.id,
    msatsRequested: BigInt(servedInvoice.mtokens),
    preimage,
    bolt11: servedBolt11,
    userId: me?.id ?? USER_ID.anon,
    actionType,
    actionState: wrappedBolt11 ? 'PENDING_HELD' : optimistic ? 'PENDING' : 'PENDING_HELD',
    actionOptimistic: optimistic,
    actionArgs: args,
    expiresAt,
    actionId
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

async function performAction (dbInvoice, paidAction, args, { ...context }) {
  const { retryForInvoice } = context
  if (retryForInvoice && paidAction.retry) {
    return await paidAction.retry({ invoiceId: retryForInvoice.id, newInvoiceId: dbInvoice?.id }, context)
  } else {
    return await paidAction.perform?.({ invoiceId: dbInvoice?.id, ...args }, context)
  }
}
