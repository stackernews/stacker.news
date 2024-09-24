import { retryPaidAction } from '../paidAction'
import { USER_ID } from '@/lib/constants'

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
    retryPaidAction: async (parent, { invoiceId }, { models, me, lnd }) => {
      if (!me) {
        throw new Error('You must be logged in')
      }

      const invoice = await models.invoice.findUnique({ where: { id: invoiceId, userId: me.id } })
      if (!invoice) {
        throw new Error('Invoice not found')
      }

      if (invoice.actionState !== 'FAILED') {
        if (invoice.actionState === 'PAID') {
          throw new Error('Invoice is already paid')
        }
        throw new Error(`Invoice is not in failed state: ${invoice.actionState}`)
      }

      const result = await retryPaidAction(invoice.actionType, { invoice }, { models, me, lnd })

      return {
        ...result,
        type: paidActionType(invoice.actionType)
      }
    }
  },
  PaidAction: {
    __resolveType: obj => obj.type
  }
}
