import { createHodlInvoice, createInvoice } from 'ln-service'
import { datePivot } from '@/lib/time'
import { USER_ID } from '@/lib/constants'
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

export const paidActions = {
  ITEM_CREATE,
  ITEM_UPDATE,
  ZAP,
  DOWN_ZAP,
  POLL_VOTE,
  TERRITORY_CREATE,
  TERRITORY_UPDATE,
  TERRITORY_BILLING,
  TERRITORY_UNARCHIVE,
  DONATE
}

export default async function performPaidAction (actionType, args, context) {
  try {
    const { me, models, forceFeeCredits } = context
    const paidAction = paidActions[actionType]

    console.group('performPaidAction', actionType, args)

    if (!paidAction) {
      throw new Error(`Invalid action type ${actionType}`)
    }

    context.me = me ? await models.user.findUnique({ where: { id: me.id } }) : undefined
    context.cost = await paidAction.getCost(args, context)

    if (!me) {
      if (!paidAction.anonable) {
        throw new Error('You must be logged in to perform this action')
      }

      console.log('we are anon so can only perform pessimistic action')
      return await performPessimisticAction(actionType, args, context)
    }

    const isRich = context.cost <= context.me.msats
    if (isRich) {
      try {
        console.log('enough fee credits available, performing fee credit action')
        return await performFeeCreditAction(actionType, args, context)
      } catch (e) {
        console.error('fee credit action failed', e)

        // if we fail with fee credits, but not because of insufficient funds, bail
        if (!e.message.includes('\\"users\\" violates check constraint \\"msats_positive\\"')) {
          throw e
        }
      }
    }

    // this is set if the worker executes a paid action in behalf of a user.
    // in that case, only payment via fee credits is possible
    // since there is no client to which we could send an invoice.
    // example: automated territory billing
    if (forceFeeCredits) {
      throw new Error('forceFeeCredits is set, but user does not have enough fee credits')
    }

    // if we fail to do the action with fee credits, we should fall back to optimistic
    if (paidAction.supportsOptimism) {
      console.log('performing optimistic action')
      return await performOptimisticAction(actionType, args, context)
    }

    console.error('action does not support optimism and fee credits failed, performing pessimistic action')
    return await performPessimisticAction(actionType, args, context)
  } catch (e) {
    console.error('performPaidAction failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}

async function performFeeCreditAction (actionType, args, context) {
  const { me, models, cost } = context
  const action = paidActions[actionType]

  return await models.$transaction(async tx => {
    context.tx = tx

    await tx.user.update({
      where: {
        id: me.id
      },
      data: {
        msats: {
          decrement: cost
        }
      }
    })

    const result = await action.perform(args, context)
    await action.onPaid?.(result, context)

    return {
      result,
      paymentMethod: 'FEE_CREDIT'
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

async function performOptimisticAction (actionType, args, context) {
  const { models } = context
  const action = paidActions[actionType]

  context.optimistic = true
  context.lndInvoice = await createLndInvoice(actionType, args, context)

  return await models.$transaction(async tx => {
    context.tx = tx

    const invoice = await createDbInvoice(actionType, args, context)

    return {
      invoice,
      result: await action.perform?.({ invoiceId: invoice.id, ...args }, context),
      paymentMethod: 'OPTIMISTIC'
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

async function performPessimisticAction (actionType, args, context) {
  const action = paidActions[actionType]

  if (!action.supportsPessimism) {
    throw new Error(`This action ${actionType} does not support pessimistic invoicing`)
  }

  // just create the invoice and complete action when it's paid
  context.lndInvoice = await createLndInvoice(actionType, args, context)
  return {
    invoice: await createDbInvoice(actionType, args, context),
    paymentMethod: 'PESSIMISTIC'
  }
}

export async function retryPaidAction (actionType, args, context) {
  const { models, me } = context
  const { invoiceId } = args

  const action = paidActions[actionType]
  if (!action) {
    throw new Error(`retryPaidAction - invalid action type ${actionType}`)
  }

  if (!me) {
    throw new Error(`retryPaidAction - must be logged in ${actionType}`)
  }

  if (!action.supportsOptimism) {
    throw new Error(`retryPaidAction - action does not support optimism ${actionType}`)
  }

  if (!action.retry) {
    throw new Error(`retryPaidAction - action does not support retrying ${actionType}`)
  }

  if (!invoiceId) {
    throw new Error(`retryPaidAction - missing invoiceId ${actionType}`)
  }

  context.optimistic = true
  context.me = await models.user.findUnique({ where: { id: me.id } })

  const { msatsRequested } = await models.invoice.findUnique({ where: { id: invoiceId, actionState: 'FAILED' } })
  context.cost = BigInt(msatsRequested)
  context.lndInvoice = await createLndInvoice(actionType, args, context)

  return await models.$transaction(async tx => {
    context.tx = tx

    // update the old invoice to RETRYING, so that it's not confused with FAILED
    const { actionId } = await tx.invoice.update({
      where: {
        id: invoiceId,
        actionState: 'FAILED'
      },
      data: {
        actionState: 'RETRYING'
      }
    })

    context.actionId = actionId

    // create a new invoice
    const invoice = await createDbInvoice(actionType, args, context)

    return {
      result: await action.retry({ invoiceId, newInvoiceId: invoice.id }, context),
      invoice,
      paymentMethod: 'OPTIMISTIC'
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

const OPTIMISTIC_INVOICE_EXPIRE = { minutes: 10 }
const PESSIMISTIC_INVOICE_EXPIRE = { minutes: 10 }

// we seperate the invoice creation into two functions because
// because if lnd is slow, it'll timeout the interactive tx
async function createLndInvoice (actionType, args, context) {
  const { me, lnd, cost, optimistic } = context
  const action = paidActions[actionType]
  const [createLNDInvoice, expirePivot] = optimistic
    ? [createInvoice, OPTIMISTIC_INVOICE_EXPIRE]
    : [createHodlInvoice, PESSIMISTIC_INVOICE_EXPIRE]

  if (cost < 1000n) {
    // sanity check
    throw new Error('The cost of the action must be at least 1 sat')
  }

  const expiresAt = datePivot(new Date(), expirePivot)
  return await createLNDInvoice({
    description: me?.hideInvoiceDesc ? undefined : await action.describe(args, context),
    lnd,
    mtokens: String(cost),
    expires_at: expiresAt
  })
}

async function createDbInvoice (actionType, args, context) {
  const { me, models, tx, lndInvoice, cost, optimistic, actionId } = context
  const db = tx ?? models
  const [expirePivot, actionState] = optimistic
    ? [OPTIMISTIC_INVOICE_EXPIRE, 'PENDING']
    : [PESSIMISTIC_INVOICE_EXPIRE, 'PENDING_HELD']

  if (cost < 1000n) {
    // sanity check
    throw new Error('The cost of the action must be at least 1 sat')
  }

  const expiresAt = datePivot(new Date(), expirePivot)
  const invoice = await db.invoice.create({
    data: {
      hash: lndInvoice.id,
      msatsRequested: cost,
      preimage: optimistic ? undefined : lndInvoice.secret,
      bolt11: lndInvoice.request,
      userId: me?.id ?? USER_ID.anon,
      actionType,
      actionState,
      actionArgs: args,
      expiresAt,
      actionId
    }
  })

  // insert a job to check the invoice after it's set to expire
  await db.$executeRaw`
      INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, expirein, priority)
      VALUES ('checkInvoice',
        jsonb_build_object('hash', ${lndInvoice.id}::TEXT), 21, true,
          ${expiresAt}::TIMESTAMP WITH TIME ZONE,
          ${expiresAt}::TIMESTAMP WITH TIME ZONE - now() + interval '10m', 100)`

  // the HMAC is only returned during invoice creation
  // this makes sure that only the person who created this invoice
  // has access to the HMAC
  invoice.hmac = createHmac(invoice.hash)

  return invoice
}
