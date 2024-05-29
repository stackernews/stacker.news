import { createHodlInvoice, createInvoice, settleHodlInvoice } from 'ln-service'
import { datePivot } from '@/lib/time'
import { verifyPayment } from '../resolvers/serial'
import { ANON_USER_ID } from '@/lib/constants'

export const paidActions = {
  BUY_CREDITS: require('./buyCredits'),
  CREATE_ITEM: require('./createItem'),
  UPDATE_ITEM: require('./updateItem'),
  ZAP: require('./zap'),
  DOWN_ZAP: require('./downZap'),
  POLL_VOTE: require('./pollVote'),
  TERRITORY_CREATE: require('./territoryCreate'),
  TERRITORY_UPDATE: require('./territoryUpdate'),
  TERRITORY_BILLING: require('./territoryBilling'),
  DONATE: require('./donate')
}

export default async function doPaidAction (actionType, args, context) {
  const { me, models, hash, hmac } = context
  const paidAction = paidActions[actionType]

  if (!paidAction) {
    throw new Error(`Invalid action type ${actionType}`)
  }

  if (!me && !paidAction.anonable) {
    throw new Error('You must be logged in to perform this action')
  }

  if (hash || hmac || !me) {
    return await doPessimiticAction(actionType, args, context)
  }

  context.user = await models.user.findUnique({ where: { id: me.id } })
  context.cost = await paidAction.getCost(args, context)
  const isRich = context.cost <= context.user.privates.msats

  if (!isRich && !paidAction.supportsOptimism) {
    return await doPessimiticAction(actionType, args, context)
  }

  if (isRich) {
    try {
      return await doFeeCreditAction(actionType, args, context)
    } catch (e) {
      // if we fail to do the action with fee credits, we should fall back to optimistic
      if (!paidAction.supportsOptimism) {
        return await doPessimiticAction(actionType, args, context)
      }
    }
  }

  if (paidAction.supportsOptimism) {
    return await doOptimisticAction(actionType, args, context)
  }

  throw new Error(`This action ${actionType} could not be done`)
}

async function doOptimisticAction (actionType, args, context) {
  const { me, models, lnd, cost, user } = context
  const action = paidActions[actionType]

  // create invoice XXX these calls are probably wrong
  const lndInv = await createInvoice({
    description: user.privates.hideInvoiceDesc ? undefined : action.describe(args, context),
    lnd,
    mtokens: String(cost),
    expires_at: datePivot(new Date(), { days: 1 })
  })
  const invoice = await models.invoice.create({
    data: {
      id: lndInv.id,
      msats: cost,
      bolt11: lndInv.request,
      userId: me.id,
      actionType,
      actionState: 'PENDING'
    }
  })

  const stmts = await action.doStatements({ invoiceId: invoice.id, ...args }, context)
  const results = await models.$transaction(stmts)
  const response = await action.resultsToResponse(results, args, context)

  return {
    invoice,
    ...response
  }
}

async function doFeeCreditAction (actionType, args, context) {
  const { me, models, cost } = context
  const action = paidActions[actionType]

  const stmts = [
    models.user.update({
      where: {
        id: me.id
      },
      data: {
        msats: {
          decrement: cost
        }
      }
    }),
    ...await action.doStatements(args, context),
    ...await action.onPaidStatements(args, context)
  ]
  const results = await models.$transaction(stmts)
  const response = await action.resultsToResponse(results.slice(1), args, context)

  return response
}

async function doPessimiticAction (actionType, args, context) {
  const { me, models, hash, hmac, user, cost, lnd } = context
  const action = paidActions[actionType]

  if (!action.supportsPessimism) {
    throw new Error(`This action ${actionType} does not support pessimistic invoicing`)
  }

  if (hmac) {
    // we have paid and want to do the action now
    const invoice = await verifyPayment(models, hash, hmac, cost)
    const fullArgs = { invoiceId: invoice?.id, ...args }
    const stmts = [
      ...await action.doStatements(fullArgs, context),
      ...await action.onPaidStatements(fullArgs, context),
      // TODO: prisma only supports other queries
      settleHodlInvoice({ secret: invoice.preimage, lnd })
    ]

    const results = await models.$transaction(stmts)
    const response = await action.resultsToResponse(results, args, context)

    return response
  } else {
    // just create the invoice and complete action when it's paid
    // create invoice XXX these calls are probably wrong
    const lndInv = await createHodlInvoice({
      description: user.privates.hideInvoiceDesc ? undefined : await action.describe(args, context),
      lnd,
      mtokens: String(cost),
      expires_at: datePivot(new Date(), { days: 1 })
    })

    const invoice = await models.invoice.create({
      data: {
        id: lndInv.id,
        msats: cost,
        preimage: lndInv.secret,
        bolt11: lndInv.request,
        userId: me?.id || ANON_USER_ID,
        actionType,
        actionState: 'PENDING'
      }
    })

    return {
      invoice
    }
  }
}
