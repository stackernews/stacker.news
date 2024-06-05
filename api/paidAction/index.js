import { createHodlInvoice, createInvoice, settleHodlInvoice } from 'ln-service'
import { datePivot } from '@/lib/time'
import { verifyPayment } from '../resolvers/serial'
import { ANON_USER_ID } from '@/lib/constants'
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
  DONATE: await import('./donate')
}

export default async function performPaidAction (actionType, args, context) {
  const { me, models, hash, hmac } = context
  const paidAction = paidActions[actionType]

  if (!paidAction) {
    throw new Error(`Invalid action type ${actionType}`)
  }

  if (!me && !paidAction.anonable) {
    throw new Error('You must be logged in to perform this action')
  }

  context.user = await models.user.findUnique({ where: { id: me.id } })
  context.cost = await paidAction.getCost(args, context)
  if (hash || hmac || !me) {
    return await performPessimiticAction(actionType, args, context)
  }

  const isRich = context.cost <= context.user.msats
  if (!isRich && !paidAction.supportsOptimism) {
    return await performPessimiticAction(actionType, args, context)
  }

  if (isRich) {
    try {
      return await performFeeCreditAction(actionType, args, context)
    } catch (e) {
      console.error('fee credit action failed ', e)
      // if we fail to do the action with fee credits, we should fall back to optimistic
      if (!paidAction.supportsOptimism) {
        return await performPessimiticAction(actionType, args, context)
      }
    }
  }

  if (paidAction.supportsOptimism) {
    return await performOptimisticAction(actionType, args, context)
  }

  throw new Error(`This action ${actionType} could not be done`)
}

async function performOptimisticAction (actionType, args, context) {
  const { me, models, lnd, cost, user } = context
  const action = paidActions[actionType]

  const expiresAt = datePivot(new Date(), { days: 1 })
  const lndInv = await createInvoice({
    description: user.hideInvoiceDesc ? undefined : await action.describe(args, context),
    lnd,
    mtokens: String(cost),
    expires_at: expiresAt
  })

  return await models.$transaction(async tx => {
    context.tx = tx

    const invoice = await tx.invoice.create({
      data: {
        hash: lndInv.id,
        msatsRequested: cost,
        bolt11: lndInv.request,
        userId: me.id,
        actionType,
        actionState: 'PENDING',
        expiresAt
      }
    })

    return {
      invoice,
      ...await action.perform({ invoiceId: invoice.id, ...args }, context)
    }
  })
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

    const response = await action.perform(args, context)
    await action.onPaid?.(response, context)

    return response
  })
}

async function performPessimiticAction (actionType, args, context) {
  const { me, models, hash, hmac, user, cost, lnd } = context
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

      const response = await action.perform(args, context)
      await action.onPaid?.(response, context)
      await settleHodlInvoice({ secret: invoice.preimage, lnd })

      return response
    })
  } else {
    // just create the invoice and complete action when it's paid
    const expiresAt = datePivot(new Date(), { days: 1 })
    const lndInv = await createHodlInvoice({
      description: user.hideInvoiceDesc ? undefined : await action.describe(args, context),
      lnd,
      mtokens: String(cost),
      expires_at: expiresAt
    })

    const invoice = await models.invoice.create({
      data: {
        hash: lndInv.id,
        msatsRequested: cost,
        preimage: lndInv.secret,
        bolt11: lndInv.request,
        userId: me?.id || ANON_USER_ID,
        actionType,
        actionState: 'PENDING',
        expiresAt
      }
    })

    // the HMAC is only returned during invoice creation
    // this makes sure that only the person who created this invoice
    // has access to the HMAC
    invoice.hmac = createHmac(invoice.hash)

    return {
      invoice
    }
  }
}
