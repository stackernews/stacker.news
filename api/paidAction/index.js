import { createHodlInvoice, createInvoice, settleHodlInvoice } from 'ln-service'
import { datePivot } from '@/lib/time'
import { verifyPayment } from '../resolvers/serial'
import { USER_ID } from '@/lib/constants'
import { createHmac } from '../resolvers/wallet'

export const paidActions = {
  BUY_CREDITS: await import('./buyCredits'),
  ITEM_CREATE: await import('./itemCreate'),
  ITEM_UPDATE: await import('./itemUpdate'),
  ZAP: await import('./zap'),
  DOWN_ZAP: await import('./downZap'),
  POLL_VOTE: await import('./pollVote'),
  TERRITORY_CREATE: await import('./territoryCreate'),
  TERRITORY_UPDATE: await import('./territoryUpdate'),
  TERRITORY_BILLING: await import('./territoryBilling'),
  TERRITORY_UNARCHIVE: await import('./territoryUnarchive'),
  DONATE: await import('./donate')
}

export default async function performPaidAction (actionType, args, context) {
  try {
    const { me, models, hash, hmac } = context
    const paidAction = paidActions[actionType]

    console.log('performPaidAction', actionType, args)

    if (!paidAction) {
      throw new Error(`Invalid action type ${actionType}`)
    }

    if (!me && !paidAction.anonable) {
      throw new Error('You must be logged in to perform this action')
    }

    context.user = me ? await models.user.findUnique({ where: { id: me.id } }) : null
    context.cost = await paidAction.getCost(args, context)
    if (hash || hmac || !me) {
      console.log('performPaidAction - hash or hmac provided, or anon', actionType, args)
      return await performPessimiticAction(actionType, args, context)
    }

    const isRich = context.cost <= context.user.msats
    if (!isRich && !paidAction.supportsOptimism) {
      console.log('performPaidAction - action does not support optimism', actionType, args)
      return await performPessimiticAction(actionType, args, context)
    }

    if (isRich) {
      try {
        console.log('performPaidAction - enough fee credits available', actionType, args)
        return await performFeeCreditAction(actionType, args, context)
      } catch (e) {
        console.error('performPaidAction - fee credit action failed ', e, actionType, args)
        // if we fail to do the action with fee credits, we should fall back to optimistic
        if (!paidAction.supportsOptimism) {
          console.error('performPaidAction - action does not support optimism and fee credits failed ', actionType, args)
          return await performPessimiticAction(actionType, args, context)
        }
      }
    }

    if (paidAction.supportsOptimism) {
      console.error('performPaidAction - trying optimism ', actionType, args)
      return await performOptimisticAction(actionType, args, context)
    }

    throw new Error(`This action ${actionType} could not be done`)
  } catch (e) {
    console.error('performPaidAction failed', e)
    throw e
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
  })
}

async function performOptimisticAction (actionType, args, context) {
  const { models } = context
  const action = paidActions[actionType]

  return await models.$transaction(async tx => {
    context.tx = tx
    context.optimistic = true

    const invoice = await createDbInvoice(actionType, args, context)

    return {
      invoice,
      result: await action.perform({ invoiceId: invoice.id, ...args }, context),
      paymentMethod: 'OPTIMISTIC'
    }
  })
}

async function performPessimiticAction (actionType, args, context) {
  const { models, hash, hmac, cost, lnd } = context
  const action = paidActions[actionType]

  if (!action.supportsPessimism) {
    throw new Error(`This action ${actionType} does not support pessimistic invoicing`)
  }

  if (hmac) {
    // we have paid and want to do the action now
    const invoice = await verifyPayment(models, hash, hmac, cost)
    args.invoiceId = invoice?.id

    return await models.$transaction(async tx => {
      context.tx = tx

      // move the invoice from HELD to PENDING so that the
      // worker can take over (calling onPaid) when the invoice is settled
      await tx.invoice.update({
        where: { id: invoice?.id, actionState: 'HELD' },
        data: {
          actionState: 'PENDING'
        }
      })

      await settleHodlInvoice({ secret: invoice.preimage, lnd })

      return {
        result: await action.perform(args, context),
        paymentMethod: 'PESSIMISTIC'
      }
    })
  } else {
    // just create the invoice and complete action when it's paid
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

  context.user = await models.user.findUnique({ where: { id: me.id } })
  return await models.$transaction(async tx => {
    context.tx = tx
    context.optimistic = true

    // update the old invoice to RETRYING, so that it's not confused with FAILED
    const { msatsRequested, actionId } = await tx.invoice.update({
      where: {
        id: invoiceId,
        actionState: 'FAILED'
      },
      data: {
        actionState: 'RETRYING'
      }
    })

    context.cost = BigInt(msatsRequested)
    context.actionId = actionId

    // create a new invoice
    const invoice = await createDbInvoice(actionType, args, context)

    return {
      result: await action.retry({ invoiceId, newInvoiceId: invoice.id }, context),
      invoice,
      paymentMethod: 'OPTIMISTIC'
    }
  })
}

const OPTIMISTIC_INVOICE_EXPIRE = { seconds: 10 } // { hours: 1 }
const PESSIMISTIC_INVOICE_EXPIRE = { seconds: 10 } // { minutes: 10 }

async function createDbInvoice (actionType, args, context) {
  const { user, models, tx, lnd, cost, optimistic, actionId } = context
  const action = paidActions[actionType]
  const createLNDInvoice = optimistic ? createInvoice : createHodlInvoice
  const db = tx ?? models

  const expiresAt = datePivot(new Date(), optimistic ? OPTIMISTIC_INVOICE_EXPIRE : PESSIMISTIC_INVOICE_EXPIRE)
  const lndInv = await createLNDInvoice({
    description: user?.hideInvoiceDesc ? undefined : await action.describe(args, context),
    lnd,
    mtokens: String(cost),
    expires_at: expiresAt
  })

  const invoice = await db.invoice.create({
    data: {
      hash: lndInv.id,
      msatsRequested: cost,
      preimage: optimistic ? undefined : lndInv.secret,
      bolt11: lndInv.request,
      userId: user?.id || USER_ID.anon,
      actionType,
      actionState: optimistic ? 'PENDING' : 'PENDING_HELD',
      expiresAt,
      actionId
    }
  })

  // insert a job to check the invoice after it's set to expire
  await db.$executeRaw`
      INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, expirein, priority)
      VALUES ('checkInvoice',
        jsonb_build_object('hash', ${lndInv.id}), 21, true, ${expiresAt},
          ${expiresAt} - now() + interval '10m', 100)`

  // the HMAC is only returned during invoice creation
  // this makes sure that only the person who created this invoice
  // has access to the HMAC
  invoice.hmac = createHmac(invoice.hash)

  return invoice
}
