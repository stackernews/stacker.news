import { USER_ID } from '@/lib/constants'
import { GqlInputError } from '@/lib/error'
import { verifyHmac } from './wallet'
import { payInCancel } from '../payIn/transitions'
import { retry } from '../payIn'

function payInResultType (payInType) {
  switch (payInType) {
    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
      return 'Item'
    case 'ZAP':
    case 'DOWN_ZAP':
    case 'BOOST':
      return 'ItemAct'
    case 'POLL_VOTE':
      return 'PollVoteResult'
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      return 'Sub'
  }
}

export async function getPayIn (parent, { id }, { me, models }) {
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
      pessimisticEnv: true,
      payInCustodialTokens: true
    }
  })
  if (!payIn) {
    throw new Error('PayIn not found')
  }
  return payIn
}

export default {
  Query: {
    payIn: getPayIn
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
    },
    retryPayIn: async (parent, { payInId }, { models, me }) => {
      return await retry(payInId, { models, me })
    }
  },
  PayIn: {
    // the payIn result is dependent on the payIn type
    // so we need to resolve the type here
    result: (parent, args) => {
      // if the payIn was paid pessimistically, the result is permanently in the pessimisticEnv
      const result = parent.result || parent.pessimisticEnv?.result
      if (result) {
        return { ...result, __typename: payInResultType(parent.payInType) }
      }
      return null
    }
  }
}
