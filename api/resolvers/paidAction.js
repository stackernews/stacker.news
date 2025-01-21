import { retryPaidAction } from '../paidAction'
import { USER_ID, WALLET_MAX_RETRIES } from '@/lib/constants'

function paidActionType (actionType) {
  switch (actionType) {
    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
      return 'ItemPaidAction'
    case 'ZAP':
    case 'DOWN_ZAP':
    case 'BOOST':
      return 'ItemActPaidAction'
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      return 'SubPaidAction'
    case 'DONATE':
      return 'DonatePaidAction'
    case 'POLL_VOTE':
      return 'PollVotePaidAction'
    case 'RECEIVE':
      return 'ReceivePaidAction'
    case 'BUY_CREDITS':
      return 'BuyCreditsPaidAction'
    default:
      throw new Error('Unknown action type')
  }
}

export default {
  Query: {
    paidAction: async (parent, { invoiceId }, { models, me }) => {
      const invoice = await models.invoice.findUnique({
        where: {
          id: invoiceId,
          userId: me?.id ?? USER_ID.anon
        }
      })
      if (!invoice) {
        throw new Error('Invoice not found')
      }

      return {
        type: paidActionType(invoice.actionType),
        invoice,
        result: invoice.actionResult,
        paymentMethod: invoice.actionOptimistic ? 'OPTIMISTIC' : 'PESSIMISTIC'
      }
    }
  },
  Mutation: {
    retryPaidAction: async (parent, { invoiceId, newAttempt }, { models, me, lnd }) => {
      if (!me) {
        throw new Error('You must be logged in')
      }

      // make sure only one client at a time can retry by immediately transitioning to an intermediate state
      const [invoice] = await models.$queryRaw`
          UPDATE "Invoice"
          SET "actionState" = 'RETRY_PENDING'
          WHERE id in (
            SELECT id FROM "Invoice"
            WHERE id = ${invoiceId} AND "userId" = ${me.id} AND "actionState" = 'FAILED'
            FOR UPDATE
          )
          RETURNING *`
      if (!invoice) {
        throw new Error('Invoice not found')
      }

      // do we want to retry a payment from the beginning with all sender and receiver wallets?
      const paymentAttempt = newAttempt ? invoice.paymentAttempt + 1 : invoice.paymentAttempt
      if (paymentAttempt > WALLET_MAX_RETRIES) {
        throw new Error('Payment has been retried too many times')
      }

      try {
        const result = await retryPaidAction(invoice.actionType, { invoice }, { paymentAttempt, models, me, lnd })
        return {
          ...result,
          type: paidActionType(invoice.actionType)
        }
      } catch (err) {
        // revert state transition to allow new retry for this invoice
        await models.invoice.update({
          where: { id: invoiceId, actionState: 'RETRY_PENDING' },
          data: { actionState: 'FAILED' }
        })
        throw err
      }
    }
  },
  PaidAction: {
    __resolveType: obj => obj.type
  }
}
