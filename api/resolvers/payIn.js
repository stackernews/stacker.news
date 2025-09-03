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
    satistics: async (parent, { cursor, inc }, { models, me }) => {
      const userId = me?.id ?? USER_ID.anon
      const decodedCursor = decodeCursor(cursor)
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
        WITH "FailedPayIns" AS (
          -- payIns whose most recent attempt failed and are not retried yet
          SELECT COALESCE("PayIn"."genesisId", "PayIn"."id") AS "genesisId"
          FROM "PayIn"
          WHERE "PayIn"."payInState" = 'FAILED'
          AND "PayIn"."payInType" IN ('ITEM_CREATE', 'ZAP', 'DOWN_ZAP', 'BOOST')
          AND "PayIn"."userId" = ${me.id}
          AND "PayIn"."successorId" IS NULL
          AND "PayIn"."payInFailureReason" <> 'USER_CANCELLED'
          AND "PayIn"."payInStateChangedAt" > now() - ${`${WALLET_RETRY_BEFORE_MS} milliseconds`}::interval
        ), "CanRetryPayIns" AS (
          -- payIns that've failed but haven't been retried WALLET_MAX_RETRIES times
          SELECT COALESCE("PayIn"."genesisId", "PayIn"."id") AS "genesisId"
          FROM "PayIn"
          WHERE "PayIn"."genesisId" IN (SELECT "genesisId" FROM "FailedPayIns")
          OR "PayIn"."id" IN (SELECT "genesisId" FROM "FailedPayIns")
          GROUP BY COALESCE("PayIn"."genesisId", "PayIn"."id")
          HAVING COUNT(*) < ${WALLET_MAX_RETRIES}
        )
        SELECT "PayIn".*
        FROM "PayIn"
        WHERE "PayIn"."genesisId" IN (SELECT "genesisId" FROM "CanRetryPayIns")
        OR "PayIn"."id" IN (SELECT "genesisId" FROM "CanRetryPayIns")`
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
    userId: (payIn, args, { me }) => {
      if (!isMine(payIn, { me })) {
        return null
      }
      return payIn.userId
    },
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
    },
    invite: async (payIn, args, { models, me }) => {
      return payIn.payOutCustodialTokens.find(token => token.payOutType === 'INVITE_GIFT')?.user?.invite
    },
    payOutCustodialTokens: async (payIn, args, { models, me }) => {
      if (typeof payIn.payOutCustodialTokens !== 'undefined') {
        return [
          ...payIn.payOutCustodialTokens,
          ...payIn.beneficiaries.reduce((acc, beneficiary) => {
            if (beneficiary.payOutCustodialTokens) {
              return [...acc, ...beneficiary.payOutCustodialTokens]
            }
            return acc
          }, [])
        ]
      }
      return await models.payOutCustodialToken.findMany({ where: { payInId: payIn.id } })
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
    mtokensAfter: (payOutCustodialToken, args, { me }) => {
      if (!isMine(payOutCustodialToken, { me })) {
        return null
      }
      return payOutCustodialToken.mtokensAfter
    },
    sub: (payOutCustodialToken) => {
      return payOutCustodialToken.subPayOutCustodialToken?.sub
    }
  }
}
