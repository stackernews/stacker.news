import { retryPaidAction } from '../paidAction'

export default {
  Mutation: {
    retryPaidAction: async (parent, { invoiceId }, { models, me, lnd }) => {
      if (!me) {
        throw new Error('You must be logged in')
      }

      const invoice = await models.invoice.findUnique({ where: { id: invoiceId, userId: me.id } })
      if (!invoice) {
        throw new Error('Invoice not found')
      }

      let type
      if (invoice.actionType === 'ITEM_CREATE') {
        type = 'ItemPaidAction'
      } else if (invoice.actionType === 'ZAP') {
        type = 'ItemActPaidAction'
      } else if (invoice.actionType === 'POLL_VOTE') {
        type = 'PollVotePaidAction'
      } else if (invoice.actionType === 'DOWN_ZAP') {
        type = 'ItemActPaidAction'
      } else {
        throw new Error('Unknown action type')
      }

      const result = await retryPaidAction(invoice.actionType, { invoiceId }, { models, me, lnd })
      console.log('retryPaidAction', result)

      return {
        ...result,
        type
      }
    }
  },
  PaidAction: {
    __resolveType: obj => obj.type
  }
}
