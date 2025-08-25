import { USER_ID } from '@/lib/constants'
import { GqlInputError } from '@/lib/error'
import { verifyHmac } from './wallet'
import { payInCancel } from '../payIn/transitions'
import { retry } from '../payIn'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { getItem } from './item'
import { getSub } from './sub'

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
      return 'PollVote'
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      return 'Sub'
  }
}

export async function getPayIn (parent, { id }, { me, models }) {
  const payIn = await models.PayIn.findUnique({
    where: { id, userId: me?.id ?? USER_ID.anon },
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

function isMine (payIn, { me }) {
  return payIn.userId === USER_ID.anon || (me && Number(me.id) === Number(payIn.userId))
}

export default {
  Query: {
    payIn: getPayIn,
    satistics: async (parent, { cursor, inc }, { models, me }) => {
      const userId = me?.id ?? USER_ID.anon
      const decodedCursor = decodeCursor(cursor)
      console.log('decodedCursor', decodedCursor)
      const payIns = await models.PayIn.findMany({
        where: {
          OR: [
            { userId },
            { payOutBolt11: { userId } },
            { payOutCustodialTokens: { some: { userId } } }
          ],
          createdAt: {
            lte: decodedCursor.time
          }
        },
        include: {
          payInBolt11: true,
          payOutBolt11: true,
          payInCustodialTokens: true,
          payOutCustodialTokens: true,
          itemPayIn: true,
          subPayIn: true
        },
        orderBy: { createdAt: 'desc' },
        take: LIMIT,
        skip: decodedCursor.offset
      })
      return {
        payIns,
        cursor: payIns.length === LIMIT ? nextCursorEncoded(decodedCursor) : null
      }
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
    },
    retryPayIn: async (parent, { payInId }, { models, me }) => {
      return await retry(payInId, { models, me })
    }
  },
  PayIn: {
    // the payIn result is dependent on the payIn type
    // so we need to resolve the type here
    result: (payIn, args, { models, me }) => {
      if (!isMine(payIn, { me })) {
        return null
      }
      // if the payIn was paid pessimistically, the result is permanently in the pessimisticEnv
      const result = payIn.result || payIn.pessimisticEnv?.result
      if (result) {
        return { ...result, __typename: payInResultType(payIn.payInType) }
      }
      return null
    },
    payInBolt11: async (payIn, args, { models, me }) => {
      if (!isMine(payIn, { me })) {
        return null
      }
      if (typeof payIn.payInBolt11 !== 'undefined') {
        return payIn.payInBolt11
      }
      return await models.payInBolt11.findUnique({ where: { payInId: payIn.id } })
    },
    payInCustodialTokens: async (payIn, args, { models, me }) => {
      if (!isMine(payIn, { me })) {
        return null
      }
      if (typeof payIn.payInCustodialTokens !== 'undefined') {
        return payIn.payInCustodialTokens
      }
      return await models.payInCustodialToken.findMany({ where: { payInId: payIn.id } })
    },
    pessimisticEnv: async (payIn, args, { models, me }) => {
      if (!isMine(payIn, { me })) {
        return null
      }
      if (typeof payIn.pessimisticEnv !== 'undefined') {
        return payIn.pessimisticEnv
      }
      return await models.pessimisticEnv.findUnique({ where: { payInId: payIn.id } })
    },
    payOutBolt11: async (payIn, args, { models, me }) => {
      if (!me) {
        return null
      }
      let payOutBolt11 = payIn.payOutBolt11
      if (!payOutBolt11) {
        payOutBolt11 = await models.payOutBolt11.findUnique({ where: { payInId: payIn.id } })
        if (payOutBolt11 && Number(payOutBolt11.userId) !== Number(me.id)) {
          // only return the amount forwarded and the type of payOut
          return { msats: payOutBolt11.msats, payOutType: payOutBolt11.payOutType }
        }
      }
      return payOutBolt11
    },
    item: async (payIn, args, { models, me }) => {
      if (!payIn.itemPayIn) {
        return null
      }
      return await getItem(payIn, { id: payIn.itemPayIn.itemId }, { models, me })
    },
    sub: async (payIn, args, { models, me }) => {
      if (!payIn.subPayIn) {
        return null
      }
      return await getSub(payIn, { name: payIn.subPayIn.subName }, { models, me })
    }
  },
  PayInBolt11: {
    preimage: (payInBolt11, args, { models, me }) => {
      // do not reveal the preimage if the invoice is not confirmed
      if (!payInBolt11.confirmedAt) {
        return null
      }
      return payInBolt11.preimage
    }
  },
  PayInCustodialToken: {
    mtokensAfter: (payInCustodialToken, args, { me }) => {
      if (!isMine(payInCustodialToken, { me })) {
        return null
      }
      return payInCustodialToken.mtokensAfter
    }
  },
  PayOutCustodialToken: {
    mtokensAfter: (payOutCustodialToken, args, { me }) => {
      if (!isMine(payOutCustodialToken, { me })) {
        return null
      }
      return payOutCustodialToken.mtokensAfter
    }
  }
}
