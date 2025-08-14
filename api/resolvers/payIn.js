import { USER_ID } from '@/lib/constants'
import { GqlInputError } from '@/lib/error'
import { verifyHmac } from './wallet'
import { payInCancel } from '../payIn/transitions'

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
  Mutation: {
    cancelPayInBolt11: async (parent, { hash, hmac, userCancel }, { models, me, boss, lnd }) => {
      const payInBolt11 = await models.PayInBolt11.findUnique({ where: { hash } })
      if (me && !hmac) {
        if (!payInBolt11) throw new GqlInputError('bolt11 not found')
        if (payInBolt11.userId !== me.id) throw new GqlInputError('not ur bolt11')
      } else {
        verifyHmac(hash, hmac)
      }
      return await payInCancel({
        data: {
          payInId: payInBolt11.payInId,
          payInFailureReason: userCancel ? 'USER_CANCELLED' : 'SYSTEM_CANCELLED'
        },
        models,
        me,
        boss,
        lnd
      })
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
