import { createHodlInvoice, createInvoice, parsePaymentRequest } from 'ln-service'
import { datePivot } from '@/lib/time'
import { PAID_ACTION_PAYMENT_METHODS, PAID_ACTION_TERMINAL_STATES, USER_ID } from '@/lib/constants'
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
import * as BUY_CREDITS from './buyCredits'
import wrapInvoice from 'wallets/wrap'
import { createInvoice as createUserInvoice } from 'wallets/server'

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
  DONATE,
  BUY_CREDITS
}

export default async function performPaidAction (actionType, args, context) {
  try {
    const { me, models, forceFeeCredits } = context
    const paidAction = paidActions[actionType]

    console.group('performPaidAction', actionType, args)

    if (!paidAction) {
      throw new Error(`Invalid action type ${actionType}`)
    }

    if (!me && !paidAction.anonable) {
      throw new Error('You must be logged in to perform this action')
    }

    context.me = me ? await models.user.findUnique({ where: { id: me.id } }) : undefined
    context.cost = await paidAction.getCost(args, context)

    // special case for zero cost actions
    if (context.cost === 0n) {
      console.log('performing zero cost action')
      return await performNoInvoiceAction(actionType, args, context, 'ZERO_COST')
    }

    for (const paymentMethod of paidAction.paymentMethods) {
      console.log(`performing payment method ${paymentMethod}`)

      if (forceFeeCredits &&
        paymentMethod !== PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT &&
        paymentMethod !== PAID_ACTION_PAYMENT_METHODS.REWARD_SATS) {
        throw new Error('forceFeeCredits is set, but user does not have enough fee credits or reward sats')
      }

      // payment methods that anonymous users can use
      if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.P2P) {
        try {
          return await performP2PAction(actionType, args, context)
        } catch (e) {
          if (!(e instanceof NonInvoiceablePeerError)) {
            console.error(`${paymentMethod} action failed`, e)
            throw e
          }
        }
      } else if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC) {
        return await performPessimisticAction(actionType, args, context)
      }

      // additionalpayment methods that logged in users can use
      if (me) {
        if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT ||
          paymentMethod === PAID_ACTION_PAYMENT_METHODS.REWARD_SATS) {
          try {
            return await performNoInvoiceAction(actionType, args, context, paymentMethod)
          } catch (e) {
            // if we fail with fee credits or reward sats, but not because of insufficient funds, bail
            console.error(`${paymentMethod} action failed`, e)
            if (!e.message.includes('\\"users\\" violates check constraint \\"mcredits_positive\\"') &&
              !e.message.includes('\\"users\\" violates check constraint \\"msats_positive\\"')) {
              throw e
            }
          }
        } else if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC) {
          return await performOptimisticAction(actionType, args, context)
        }
      }
    }
  } catch (e) {
    console.error('performPaidAction failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}

async function performNoInvoiceAction (actionType, args, context, paymentMethod) {
  const { me, models, cost } = context
  const action = paidActions[actionType]

  const result = await models.$transaction(async tx => {
    context.tx = tx

    if (paymentMethod === 'REWARD_SATS' || paymentMethod === 'FEE_CREDIT') {
      await tx.user.update({
        where: {
          id: me?.id ?? USER_ID.anon
        },
        data: paymentMethod === 'REWARD_SATS'
          ? { msats: { decrement: cost } }
          : { mcredits: { decrement: cost } }
      })
    }

    const result = await action.perform(args, context)
    await action.onPaid?.(result, context)

    return {
      result,
      paymentMethod
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

  // run non critical side effects in the background
  // after the transaction has been committed
  action.nonCriticalSideEffects?.(result.result, context).catch(console.error)
  return result
}

async function performOptimisticAction (actionType, args, context) {
  const { models } = context
  const action = paidActions[actionType]

  context.optimistic = true
  const invoiceArgs = context.invoiceArgs ?? await createSNInvoice(actionType, args, context)

  return await models.$transaction(async tx => {
    context.tx = tx

    const invoice = await createDbInvoice(actionType, args, context, invoiceArgs)

    return {
      invoice,
      result: await action.perform?.({ invoiceId: invoice.id, ...args }, context),
      paymentMethod: 'OPTIMISTIC'
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

async function performPessimisticAction (actionType, args, context) {
  const action = paidActions[actionType]

  if (!action.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC)) {
    throw new Error(`This action ${actionType} does not support pessimistic invoicing`)
  }

  // just create the invoice and complete action when it's paid
  const invoiceArgs = context.invoiceArgs ?? await createSNInvoice(actionType, args, context)
  return {
    invoice: await createDbInvoice(actionType, args, context, invoiceArgs),
    paymentMethod: 'PESSIMISTIC'
  }
}

async function performP2PAction (actionType, args, context) {
  const { me } = context
  const invoiceArgs = await createWrappedInvoice(actionType, args, context)
  context.invoiceArgs = invoiceArgs

  return me
    ? await performOptimisticAction(actionType, args, context)
    : await performPessimisticAction(actionType, args, context)
}

export async function retryPaidAction (actionType, args, context) {
  const { models, me } = context
  const { invoice: failedInvoice } = args

  console.log('retryPaidAction', actionType, args)

  const action = paidActions[actionType]
  if (!action) {
    throw new Error(`retryPaidAction - invalid action type ${actionType}`)
  }

  if (!me) {
    throw new Error(`retryPaidAction - must be logged in ${actionType}`)
  }

  if (!action.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC)) {
    throw new Error(`retryPaidAction - action does not support optimism ${actionType}`)
  }

  if (!action.retry) {
    throw new Error(`retryPaidAction - action does not support retrying ${actionType}`)
  }

  if (!failedInvoice) {
    throw new Error(`retryPaidAction - missing invoice ${actionType}`)
  }

  context.optimistic = true
  context.me = await models.user.findUnique({ where: { id: me.id } })

  const { msatsRequested, actionId } = failedInvoice
  context.cost = BigInt(msatsRequested)
  context.actionId = actionId
  const invoiceArgs = await createSNInvoice(actionType, args, context)

  return await models.$transaction(async tx => {
    context.tx = tx

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

    // create a new invoice
    const invoice = await createDbInvoice(actionType, args, context, invoiceArgs)

    return {
      result: await action.retry({ invoiceId: failedInvoice.id, newInvoiceId: invoice.id }, context),
      invoice,
      paymentMethod: 'OPTIMISTIC'
    }
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

export async function createWrappedInvoice (actionType, args, context) {
  // if the action has an invoiceable peer, we'll create a peer invoice
  // wrap it, and return the wrapped invoice
  const { cost, models, lnd, me } = context
  const userId = await paidActions[actionType]?.invoiceablePeer?.(args, context)
  if (!userId) {
    throw new NonInvoiceablePeerError()
  }

  await assertBelowMaxPendingInvoices(context)

  const description = await paidActions[actionType].describe(args, context)
  const { invoice: bolt11, wallet } = await createUserInvoice(userId, {
    // this is the amount the stacker will receive, the other 3/10ths is the sybil fee
    msats: cost * BigInt(7) / BigInt(10),
    description,
    expiry: INVOICE_EXPIRE_SECS
  }, { models })

  const { invoice: wrappedInvoice, maxFee } = await wrapInvoice(
    bolt11, { msats: cost, description }, { me, lnd })

  return {
    bolt11,
    wrappedBolt11: wrappedInvoice.request,
    wallet,
    maxFee
  }
}

// we seperate the invoice creation into two functions because
// because if lnd is slow, it'll timeout the interactive tx
async function createSNInvoice (actionType, args, context) {
  const { me, lnd, cost, optimistic } = context
  const action = paidActions[actionType]
  const createLNDInvoice = optimistic ? createInvoice : createHodlInvoice

  if (cost < 1000n) {
    // sanity check
    throw new Error('The cost of the action must be at least 1 sat')
  }

  const expiresAt = datePivot(new Date(), { seconds: INVOICE_EXPIRE_SECS })
  const invoice = await createLNDInvoice({
    description: me?.hideInvoiceDesc ? undefined : await action.describe(args, context),
    lnd,
    mtokens: String(cost),
    expires_at: expiresAt
  })
  return { bolt11: invoice.request, preimage: invoice.secret }
}

async function createDbInvoice (actionType, args, context,
  { bolt11, wrappedBolt11, preimage, wallet, maxFee }) {
  const { me, models, tx, cost, optimistic, actionId } = context
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
