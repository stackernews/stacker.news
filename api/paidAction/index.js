import { createHodlInvoice, createInvoice } from 'ln-service'
import { lnd } from '../lnd'
import { datePivot } from '@/lib/time'
import { wrapZapInvoice } from '@/api/createInvoice/wrap'

export default async function performPaidAction (actionType, args, context) {
  const { me, models, hash, hmac } = context
  const paidAction = paidActions[actionType]

  if (!paidAction) {
    throw new Error(`Invalid action type ${actionType}`)
  }

  if (!me && !paidAction.anonable) {
    throw new Error('You must be logged in to perform this action')
  }

  if (hash && hmac) {
    // this is a pessimistic action that's already paid for
    if (!paidAction.supportsPessimism) {
      throw new Error(`This action ${actionType} does not support pessimistic invoicing`)
    }

    // TODO: check hash and hmac pay getCost amount
    const data = await paidAction.perform(args, context)
    await paidAction.onPaid(args, context)
    // TODO: settle the invoice

    return {
      data
    }
  } else if (paidAction.peer2peerable && paidAction.shouldDoPeer2Peer(args, context)) {
    // this is a peer-to-peer action
    const costMsats = await paidAction.getCost(args, context)
    const invoice = await wrapZapInvoice({ msats: costMsats, ...args }, context)
    const stmts = await paidAction.performStatements({ invoiceId: invoice?.id, ...args }, context)
    const data = await models.$transaction(stmts)

    return {
      invoice,
      data
    }
  } else {
    // this is a action we can use fee credits for

    // get cost
    const costMsats = await paidAction.getCost(args, context)

    // check if user has enough credits
    const user = await models.user.findUnique({ where: { id: me.id } })

    if (paidAction.supportsOptimism && me) {
      if (costMsats > user.privates.msats) {
        // create invoice XXX these calls are probably wrong
        const lndInv = await createInvoice({
          description: user.privates.hideInvoiceDesc ? undefined : actionType,
          lnd,
          mtokens: String(costMsats),
          expires_at: datePivot(new Date(), { days: 1 })
        })
        const invoice = await models.invoice.create({
          data: {
            id: lndInv.id,
            msats: costMsats,
            bolt11: lndInv.request,
            userId: me.id,
            actionType,
            actionState: 'PENDING'
          }
        })
        const data = await paidAction.perform({ invoiceId: invoice?.id, ...args }, context)

        return {
          invoice,
          data
        }
      } else {
        // TODO: subtract cost from user's credits
        const data = await paidAction.perform({ invoiceId: null, ...args }, context)
        await paidAction.onPaid(args, context)

        return {
          data
        }
      }
    } else if (paidAction.supportsPessimism) {
      // could also be anonymous user
      // create invoice XXX these calls are probably wrong
      const lndInv = await createHodlInvoice({
        description: user.privates.hideInvoiceDesc ? undefined : actionType,
        lnd,
        mtokens: String(costMsats),
        expires_at: datePivot(new Date(), { days: 1 })
      })
      const invoice = await models.invoice.create({
        data: {
          id: lndInv.id,
          msats: costMsats,
          preimage: lndInv.secret,
          bolt11: lndInv.request,
          userId: me.id,
          actionType,
          actionState: 'PENDING'
        }
      })

      return {
        invoice
      }
    } else {
      throw new Error(`This action ${actionType} could not be done`)
    }
  }
}

export const paidActions = {
  CREATE_ITEM: require('./createItem'),
  UPDATE_ITEM: require('./updateItem'),
  ZAP: require('./zap')
}
