import { createHodlInvoice, createInvoice, settleHodlInvoice } from 'ln-service'
import { datePivot } from '@/lib/time'
import { USER_ID } from '@/lib/constants'
import { createHmac } from '../resolvers/wallet'
import { Prisma } from '@prisma/client'
import { timingSafeEqual } from 'crypto'
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
    const { me, models, hash, hmac, forceFeeCredits } = context
    const paidAction = paidActions[actionType]

    console.group('performPaidAction', actionType, args)

    if (!paidAction) {
      throw new Error(`Invalid action type ${actionType}`)
    }

    if (!me && !paidAction.anonable) {
      throw new Error('You must be logged in to perform this action')
    }

    context.user = me ? await models.user.findUnique({ where: { id: me.id } }) : null
    context.cost = await paidAction.getCost(args, context)
    if (hash || hmac || !me) {
      console.log('hash or hmac provided, or anon, performing pessimistic action')
      return await performPessimisticAction(actionType, args, context)
    }

    const isRich = context.cost <= context.user.msats
    if (isRich) {
      try {
        console.log('enough fee credits available, performing fee credit action')
        return await performFeeCreditAction(actionType, args, context)
      } catch (e) {
        console.error('fee credit action failed', e)

        // if we fail to do the action with fee credits, but the cost is 0, we should bail
        if (context.cost === 0n) {
          throw e
        }

        // if we fail to do the action with fee credits, we should fall back to optimistic
        if (!paidAction.supportsOptimism) {
          console.error('action does not support optimism and fee credits failed, performing pessimistic action')
          return await performPessimisticAction(actionType, args, context)
        }
      }
    } else {
      // this is set if the worker executes a paid action in behalf of a user.
      // in that case, only payment via fee credits is possible
      // since there is no client to which we could send an invoice.
      // example: automated territory billing
      if (forceFeeCredits) {
        throw new Error('forceFeeCredits is set, but user does not have enough fee credits')
      }

      if (!paidAction.supportsOptimism) {
        console.log('not enough fee credits available, optimism not supported, performing pessimistic action')
        return await performPessimisticAction(actionType, args, context)
      }
    }

    if (paidAction.supportsOptimism) {
      console.log('performing optimistic action')
      return await performOptimisticAction(actionType, args, context)
    }

    throw new Error(`This action ${actionType} could not be done`)
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
  const { models, lnd } = context
  const action = paidActions[actionType]

  if (!action.supportsPessimism) {
    throw new Error(`This action ${actionType} does not support pessimistic invoicing`)
  }

  if (context.hmac) {
    return await models.$transaction(async tx => {
      context.tx = tx

      // make sure the invoice is HELD
      const invoice = await verifyPayment(context)
      args.invoiceId = invoice.id

      // make sure to perform before settling so we don't race with worker to onPaid
      const result = await action.perform(args, context)

      // XXX this might cause the interactive tx to time out
      await settleHodlInvoice({ secret: invoice.preimage, lnd })

      return {
        result,
        paymentMethod: 'PESSIMISTIC'
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
  } else {
    // just create the invoice and complete action when it's paid
    context.lndInvoice = await createLndInvoice(actionType, args, context)
    return {
      invoice: await createDbInvoice(actionType, args, context),
      paymentMethod: 'PESSIMISTIC'
    }
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
  context.user = await models.user.findUnique({ where: { id: me.id } })

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
  const { user, lnd, cost, optimistic } = context
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
    description: user?.hideInvoiceDesc ? undefined : await action.describe(args, context),
    lnd,
    mtokens: String(cost),
    expires_at: expiresAt
  })
}

async function createDbInvoice (actionType, args, context) {
  const { user, models, tx, lndInvoice, cost, optimistic, actionId } = context
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
      userId: user?.id || USER_ID.anon,
      actionType,
      actionState,
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

export async function verifyPayment ({ hash, hmac, models, cost }) {
  if (!hash) {
    throw new Error('hash required')
  }

  if (!hmac) {
    throw new Error('hmac required')
  }

  const hmac2 = createHmac(hash)
  if (!timingSafeEqual(Buffer.from(hmac), Buffer.from(hmac2))) {
    throw new Error('hmac invalid')
  }

  const invoice = await models.invoice.findUnique({
    where: {
      hash,
      actionState: 'HELD'
    }
  })

  if (!invoice) {
    throw new Error('invoice not found')
  }

  if (invoice.msatsReceived < cost) {
    throw new Error('invoice amount too low')
  }

  return invoice
}
