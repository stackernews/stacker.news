import { USER_ID } from '@/lib/constants'

function payInResultType (payInType) {
  switch (payInType) {
    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
      return 'Item'
    case 'ZAP':
    case 'DOWN_ZAP':
    case 'BOOST':
      return 'ItemActResult'
    case 'POLL_VOTE':
      return 'PollVoteResult'
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      return 'Sub'
  }
}

export default {
  Query: {
    payIn: async (parent, { id }, { models, me }) => {
      const payIn = await models.PayIn.findUnique({
        where: { id, userId: me?.id ?? USER_ID.ANON },
        include: {
          payInBolt11: {
            include: {
              lud18Data: true,
              nostrNote: true,
              comment: true
            }
          },
          payInCustodialTokens: true
        }
      })
      if (!payIn) {
        throw new Error('PayIn not found')
      }

      return payIn
    }
  },
  PayIn: {
    result: (parent, args) => {
      if (parent.result) {
        return { ...parent.result, __typename: payInResultType(parent.payInType) }
      }
      return null
    }
  }
}
