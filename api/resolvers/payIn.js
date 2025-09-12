import { USER_ID, WALLET_MAX_RETRIES, WALLET_RETRY_BEFORE_MS } from '@/lib/constants'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
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

const INCLUDE_PAYOUT_CUSTODIAL_TOKENS = {
  include: {
    user: {
      include: {
        invite: true
      }
    },
    subPayOutCustodialToken: {
      include: {
        sub: true
      }
    }
  }
}

const INCLUDE = {
  payInBolt11: {
    include: {
      lud18Data: true,
      nostrNote: true,
      comment: true
    }
  },
  payOutBolt11: {
    include: {
      user: true
    }
  },
  pessimisticEnv: true,
  payInCustodialTokens: true,
  payOutCustodialTokens: INCLUDE_PAYOUT_CUSTODIAL_TOKENS,
  beneficiaries: {
    include: {
      payOutCustodialTokens: INCLUDE_PAYOUT_CUSTODIAL_TOKENS
    }
  },
  itemPayIn: true,
  subPayIn: true
}

export async function getPayIn (parent, { id }, { me, models }) {
  const payIn = await models.PayIn.findUnique({
    where: { id },
    include: INCLUDE
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
    satistics: async (parent, { cursor }, { models, me }) => {
      const userId = me?.id ?? USER_ID.anon
      const decodedCursor = decodeCursor(cursor)
      console.log('satistics', decodedCursor)
      const payIns = await models.PayIn.findMany({
        where: {
          OR: [
            { userId },
            { payOutBolt11: { userId } },
            { payOutCustodialTokens: { some: { userId } } }
          ],
          benefactorId: null,
          createdAt: {
            lte: decodedCursor.time
          }
        },
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: LIMIT,
        skip: decodedCursor.offset
      })
      console.log('satistics nextCursorEncoded', decodeCursor(nextCursorEncoded(decodedCursor)))
      return {
        payIns,
        cursor: payIns.length === LIMIT ? nextCursorEncoded(decodedCursor) : null
      }
    },
    failedPayIns: async (parent, args, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      return await models.$queryRaw`
          -- payIns whose most recent attempt failed, are not retried enough times yet,
          -- are not too old, and weren't manually cancelled
          SELECT "PayIn".*
          FROM "PayIn"
          WHERE "PayIn"."payInState" = 'FAILED'
          AND "PayIn"."payInType" IN ('ITEM_CREATE', 'ZAP', 'DOWN_ZAP', 'BOOST')
          AND "PayIn"."userId" = ${me.id}
          AND "PayIn"."successorId" IS NULL
          AND "PayIn"."payInFailureReason" <> 'USER_CANCELLED'
          AND "PayIn"."payInStateChangedAt" > now() - ${`${WALLET_RETRY_BEFORE_MS} milliseconds`}::interval
          AND (
            "PayIn"."genesisId" IS NULL
            OR (
                SELECT COUNT(*)
                FROM "PayIn" sibling
                WHERE "sibling"."genesisId" = "PayIn"."genesisId"
                OR "sibling"."id" = "PayIn"."genesisId"
              ) < ${WALLET_MAX_RETRIES}
            )
          ORDER BY "PayIn"."payInStateChangedAt" ASC`
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
    payerPrivates: (payIn, args, { models, me }) => {
      if (!isMine(payIn, { me })) {
        return null
      }
      return payIn
    },
    payInBolt11Public: (payIn, args, { models, me }) => {
      if (!payIn.payInBolt11) {
        return null
      }
      return { msats: payIn.payInBolt11?.msatsRequested }
    },
    payOutBolt11Public: (payIn, args, { models, me }) => {
      if (!payIn.payOutBolt11) {
        return null
      }
      return { msats: payIn.payOutBolt11?.msats, payOutType: payIn.payOutBolt11?.payOutType }
    },
    payeePrivates: (payIn, args, { models, me }) => {
      // if I'm logged in, and the payOutBolt11 is mine, let them see it
      if (!me || !payIn.payOutBolt11 || Number(payIn.payOutBolt11.userId) !== Number(me.id)) {
        return null
      }
      return payIn
    },
    item: async (payIn, args, { models, me }) => {
      // downzaps are private to the payer
      if (!payIn.itemPayIn || (!isMine(payIn, { me }) && payIn.payInType === 'DOWN_ZAP')) {
        return null
      }
      return await getItem(payIn, { id: payIn.itemPayIn.itemId }, { models, me })
    },
    payOutCustodialTokens: async (payIn, args, { models, me }) => {
      let payOutCustodialTokens = []
      if (typeof payIn.payOutCustodialTokens !== 'undefined') {
        payOutCustodialTokens = [
          ...payIn.payOutCustodialTokens,
          ...payIn.beneficiaries.reduce((acc, beneficiary) => {
            if (beneficiary.payOutCustodialTokens) {
              return [...acc, ...beneficiary.payOutCustodialTokens]
            }
            return acc
          }, [])
        ]
      } else {
        payOutCustodialTokens = await models.payOutCustodialToken.findMany({ where: { payInId: payIn.id } })
      }

      if (isMine(payIn, { me })) {
        return payOutCustodialTokens
      }

      // if it's not mine, we need to hide the routing fee
      // by removing the routing fee and adding the amount to the rewards pool
      const routingFee = payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')
      const rewardsPool = payOutCustodialTokens.find(t => t.payOutType === 'REWARDS_POOL')
      if (routingFee && rewardsPool) {
        const withoutRoutingFee = payOutCustodialTokens.filter(t => t.payOutType !== 'ROUTING_FEE')
        rewardsPool.mtokens += routingFee.mtokens
        payOutCustodialTokens = withoutRoutingFee
      }

      return payOutCustodialTokens
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
  PayOutCustodialToken: {
    privates: (payOutCustodialToken, args, { models, me }) => {
      if (!isMine(payOutCustodialToken, { me })) {
        return null
      }
      return payOutCustodialToken
    },
    sometimesPrivates: (payOutCustodialToken, args, { models, me }) => {
      if (!isMine(payOutCustodialToken, { me }) && ['INVITE_GIFT', 'REWARD'].includes(payOutCustodialToken.payOutType)) {
        return null
      }
      return payOutCustodialToken
    },
    sub: (payOutCustodialToken, args, { models, me }) => {
      if (!payOutCustodialToken.subPayOutCustodialToken) {
        return null
      }
      return payOutCustodialToken.subPayOutCustodialToken.sub
    }
  },
  PayerPrivates: {
    payInBolt11: async (payIn, args, { models, me }) => {
      if (typeof payIn.payInBolt11 !== 'undefined') {
        return payIn.payInBolt11
      }
      return await models.payInBolt11.findUnique({ where: { payInId: payIn.id } })
    },
    payInCustodialTokens: async (payIn, args, { models, me }) => {
      let payInCustodialTokens = payIn.payInCustodialTokens
      if (typeof payInCustodialTokens === 'undefined') {
        payInCustodialTokens = await models.payInCustodialToken.findMany({ where: { payInId: payIn.id } })
      }
      return payInCustodialTokens.map(token => ({
        ...token,
        mtokensAfter: isMine(payIn, { me }) ? token.mtokensAfter : null
      }))
    },
    pessimisticEnv: async (payIn, args, { models, me }) => {
      if (typeof payIn.pessimisticEnv !== 'undefined') {
        return payIn.pessimisticEnv
      }
      return await models.pessimisticEnv.findUnique({ where: { payInId: payIn.id } })
    },
    result: (payIn, args, { models, me }) => {
      // if the payIn was paid pessimistically, the result is permanently in the pessimisticEnv
      const result = payIn.result || payIn.pessimisticEnv?.result
      if (result) {
        return { ...result, __typename: payInResultType(payIn.payInType) }
      }
      return null
    },
    invite: async (payIn, args, { models, me }) => {
      return payIn.payOutCustodialTokens.find(token => token.payOutType === 'INVITE_GIFT')?.user?.invite
    },
    sub: async (payIn, args, { models, me }) => {
      if (!payIn.subPayIn) {
        return null
      }
      return await getSub(payIn, { name: payIn.subPayIn.subName }, { models, me })
    }
  },
  PayeePrivates: {
    payOutBolt11: async (payIn, args, { models, me }) => {
      if (typeof payIn.payOutBolt11 !== 'undefined') {
        return payIn.payOutBolt11
      }
      return await models.payOutBolt11.findUnique({ where: { payInId: payIn.id } })
    }
  }
}
