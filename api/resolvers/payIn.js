import { USER_ID, WALLET_MAX_RETRIES, WALLET_RETRY_BEFORE_MS } from '@/lib/constants'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { verifyHmac } from './wallet'
import { payInCancel } from '../payIn/transitions'
import { retry } from '../payIn'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { getItem } from './item'
import { getSub } from './sub'
import { Prisma } from '@prisma/client'

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

function isMine (payIn, { me }) {
  return payIn.userId === USER_ID.anon || (me && Number(me.id) === Number(payIn.userId))
}

export async function getPayIn (parent, { id }, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }
  const payIn = (await getPayInFull({
    models,
    query: Prisma.sql`SELECT * FROM "PayIn" WHERE "PayIn"."id" = ${id}`
  }))[0]
  console.log(payIn)
  if (!payIn) {
    throw new Error('PayIn not found')
  }
  if (Number(payIn.userId) !== Number(me.id)
    && !payIn.payOutCustodialTokens.some(token => Number(token.userId) === Number(me.id))
    && Number(payIn.payOutBolt11?.userId) !== Number(me.id)) {
    throw new GqlAuthenticationError()
  }
  return payIn
}

export default {
  Query: {
    payIn: getPayIn,
    satistics: async (parent, { cursor }, { models, me }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      const userId = me.id
      const decodedCursor = decodeCursor(cursor)
      const offset = decodedCursor.offset
      const limit = LIMIT

      // why we need the union:
      // if we are paying in, we want a row for that when it's created, regardless of whether it's succeeded, pending, or failed
      //    that's because payInCustodialTokens are created when the payIn is created
      // if we are paid out, we want a row for that too if the payIn is paid or it failed and we are refunded
      //    that's because payOutCustodialTokens and refundCustodialTokens are created when the payIn is paid and refunded respectively
      // this helps provide a linear timeline of custodial token changes (ie mtokensAfter changes)
      const payIns = await getPayInFull({
        models,
        query: Prisma.sql`
          (
            SELECT "PayIn".*, created_at as "sortTime", true as "isSend"
            FROM "PayIn"
            WHERE "PayIn"."userId" = ${userId}
            AND "PayIn"."benefactorId" IS NULL
            AND "PayIn"."mcost" > 0
            AND "PayIn"."payInStateChangedAt" <= ${decodedCursor.time}
            ORDER BY "sortTime" DESC
            LIMIT ${limit + offset}
          )
          UNION ALL
          (
            SELECT "PayIn".*, "payInStateChangedAt" as "sortTime", false as "isSend"
            FROM "PayIn"
            LEFT JOIN LATERAL (
              SELECT "RefundCustodialToken".*
              FROM "RefundCustodialToken"
              WHERE "RefundCustodialToken"."payInId" = "PayIn"."id" AND "PayIn"."userId" = ${userId}
            ) "RefundCustodialToken" ON true
            LEFT JOIN LATERAL (
              SELECT "PayOutBolt11".*
              FROM "PayOutBolt11"
              WHERE "PayOutBolt11"."payInId" = "PayIn"."id" AND "PayOutBolt11"."userId" = ${userId}
              AND "PayIn"."payInState" = 'PAID' AND "PayIn"."payInType" NOT IN ('PROXY_PAYMENT', 'WITHDRAWAL', 'AUTO_WITHDRAWAL')
            ) "PayOutBolt11" ON true
            LEFT JOIN LATERAL (
              SELECT "PayOutCustodialToken".*
              FROM "PayOutCustodialToken"
              WHERE "PayOutCustodialToken"."payInId" = "PayIn"."id" AND "PayOutCustodialToken"."userId" = ${userId}
              AND "PayIn"."payInState" = 'PAID'
            ) "PayOutCustodialToken" ON true
            WHERE ("RefundCustodialToken".id IS NOT NULL OR "PayOutBolt11".id IS NOT NULL OR "PayOutCustodialToken".id IS NOT NULL)
            AND "PayIn"."benefactorId" IS NULL
            AND "PayIn"."mcost" > 0
            AND "PayIn"."payInStateChangedAt" <= ${decodedCursor.time}
            ORDER BY "sortTime" DESC
            LIMIT ${limit + offset}
          )`,
        orderBy: Prisma.sql`ORDER BY "sortTime" DESC`,
        prependGroupBy: Prisma.sql`"PayIn"."sortTime", "PayIn"."isSend", `,
        offset,
        limit
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

      // obscure rewards if they are not mine
      if (payIn.payInType === 'REWARDS') {
        const myReward = payOutCustodialTokens.find(t => t.payOutType === 'REWARD' && t.userId === me.id)
        const remainingOtherReward = payOutCustodialTokens.filter(t => t.payOutType === 'REWARD' && t.userId !== me.id)[0]
        if (remainingOtherReward) {
          const restRewards = {
            id: remainingOtherReward.id,
            payOutType: 'REWARD',
            mtokens: BigInt(payIn.mcost) - BigInt(myReward.mtokens),
            custodialTokenType: 'SATS'
          }
          return [myReward, restRewards]
        }
        return [myReward]
      }

      // if this is a zap, we can see the routing fee and rewards pool
      if (!payIn.payOutBolt11 || isMine(payIn.payOutBolt11, { me })) {
        return payOutCustodialTokens
      }

      // if it's not mine, we need to hide the routing fee
      // by removing the routing fee and adding the amount to the rewards pool
      const routingFee = payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')
      const rewardsPool = payOutCustodialTokens.find(t => t.payOutType === 'REWARDS_POOL')
      if (routingFee && rewardsPool) {
        const withoutRoutingFee = payOutCustodialTokens.filter(t => t.payOutType !== 'ROUTING_FEE')
        rewardsPool.mtokens = BigInt(routingFee.mtokens) + BigInt(rewardsPool.mtokens)
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
    refundCustodialTokens: async (payIn, args, { models, me }) => {
      let refundCustodialTokens = payIn.refundCustodialTokens
      if (typeof refundCustodialTokens === 'undefined') {
        refundCustodialTokens = await models.refundCustodialToken.findMany({ where: { payInId: payIn.id } })
      }
      return refundCustodialTokens.map(token => ({
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

/*
  getPayInFull mimics a Prisma query with the same includes, but uses raw SQL
  so we can do more complex selection of payIns

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
*/

async function getPayInFull ({ models, query, offset = 0, limit = LIMIT, orderBy = Prisma.sql``, prependGroupBy = Prisma.sql`` }) {
  const payOutCustodialTokens = payInIdFragment => Prisma.sql`
    SELECT "PayOutCustodialToken".*, to_jsonb(users.*) || jsonb_build_object('invite', to_jsonb("Invite".*)) as "user", (array_agg(to_jsonb("SubPayOutCustodialToken".*)))[1] as "subPayOutCustodialToken"
    FROM "PayOutCustodialToken"
    JOIN "users" ON "users"."id" = "PayOutCustodialToken"."userId"
    LEFT JOIN "Invite" ON "Invite"."id" = "users"."inviteId"
    LEFT JOIN LATERAL (
      SELECT "SubPayOutCustodialToken".*, to_jsonb("Sub".*) as "sub"
      FROM "SubPayOutCustodialToken"
      JOIN "Sub" ON "Sub"."name" = "SubPayOutCustodialToken"."subName"
      WHERE "SubPayOutCustodialToken"."payOutCustodialTokenId" = "PayOutCustodialToken"."id"
    ) "SubPayOutCustodialToken" ON true
    WHERE "PayOutCustodialToken"."payInId" = ${payInIdFragment}
    GROUP BY "PayOutCustodialToken"."id", users.id, "Invite".id
  `

  return await models.$queryRaw`
    SELECT "PayIn".*, "PayIn"."created_at" as "createdAt", "PayIn"."updated_at" as "updatedAt",
      (array_agg(to_jsonb("PessimisticEnv".*)))[1] as "pessimisticEnv",
      (array_agg(to_jsonb("ItemPayIn".*)))[1] as "itemPayIn",
      (array_agg(to_jsonb("SubPayIn".*)))[1] as "subPayIn",
      (array_agg(to_jsonb("PayInBolt11".*)))[1] as "payInBolt11",
      (array_agg(to_jsonb("PayOutBolt11".*)))[1] as "payOutBolt11",
      COALESCE(array_agg(DISTINCT to_jsonb("PayInCustodialToken".*)) FILTER (WHERE "PayInCustodialToken"."id" IS NOT NULL), '{}') as "payInCustodialTokens",
      COALESCE(array_agg(DISTINCT to_jsonb("PayOutCustodialToken".*)) FILTER (WHERE "PayOutCustodialToken"."id" IS NOT NULL), '{}') as "payOutCustodialTokens",
      COALESCE(array_agg(DISTINCT to_jsonb("Beneficiary".*)) FILTER (WHERE "Beneficiary"."id" IS NOT NULL), '{}') as "beneficiaries",
      COALESCE(array_agg(DISTINCT to_jsonb("RefundCustodialToken".*)) FILTER (WHERE "RefundCustodialToken"."id" IS NOT NULL), '{}') as "refundCustodialTokens"
    FROM (
      ${query}
      ${orderBy}
      OFFSET ${offset}
      LIMIT ${limit}
    ) "PayIn"
    LEFT JOIN "PessimisticEnv" ON "PessimisticEnv"."payInId" = "PayIn"."id"
    LEFT JOIN "ItemPayIn" ON "ItemPayIn"."payInId" = "PayIn"."id"
    LEFT JOIN "SubPayIn" ON "SubPayIn"."payInId" = "PayIn"."id"
    LEFT JOIN LATERAL (
      SELECT "PayInBolt11".*,
        to_jsonb("PayInBolt11Lud18".*) as "lud18Data",
        to_jsonb("PayInBolt11NostrNote".*) as "nostrNote",
        to_jsonb("PayInBolt11Comment".*) as "comment"
      FROM "PayInBolt11"
      LEFT JOIN "PayInBolt11Lud18" ON "PayInBolt11Lud18"."payInBolt11Id" = "PayInBolt11"."id"
      LEFT JOIN "PayInBolt11NostrNote" ON "PayInBolt11NostrNote"."payInBolt11Id" = "PayInBolt11"."id"
      LEFT JOIN "PayInBolt11Comment" ON "PayInBolt11Comment"."payInBolt11Id" = "PayInBolt11"."id"
      WHERE "PayInBolt11"."payInId" = "PayIn"."id"
    ) "PayInBolt11" ON "PayInBolt11"."payInId" = "PayIn"."id"
    LEFT JOIN LATERAL (
      SELECT "PayOutBolt11".*, to_jsonb(users.*) as "user"
      FROM "PayOutBolt11"
      JOIN users ON users.id = "PayOutBolt11"."userId"
      WHERE "PayOutBolt11"."payInId" = "PayIn"."id"
    ) "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn"."id"
    LEFT JOIN "PayInCustodialToken" ON "PayInCustodialToken"."payInId" = "PayIn"."id"
    LEFT JOIN LATERAL (
      ${payOutCustodialTokens(Prisma.sql`"PayIn"."id"`)}
    ) "PayOutCustodialToken" ON "PayOutCustodialToken"."payInId" = "PayIn"."id"
    LEFT JOIN LATERAL (
      SELECT beneficiary.*, array_agg("PayOutCustodialToken".*) as "payOutCustodialTokens"
      FROM "PayIn" beneficiary
      LEFT JOIN LATERAL (
        ${payOutCustodialTokens(Prisma.sql`beneficiary."id"`)}
      ) "PayOutCustodialToken" ON "PayOutCustodialToken"."payInId" = beneficiary."id"
      WHERE "PayIn"."id" = beneficiary."benefactorId"
      GROUP BY beneficiary."id"
    ) "Beneficiary" ON "Beneficiary"."benefactorId" = "PayIn"."id"
    LEFT JOIN "RefundCustodialToken" ON "RefundCustodialToken"."payInId" = "PayIn"."id"
    GROUP BY ${prependGroupBy} "PayIn"."id", "PayIn"."created_at", "PayIn"."updated_at", "PayIn"."mcost", "PayIn"."payInType", "PayIn"."payInState", "PayIn"."payInFailureReason", "PayIn"."payInStateChangedAt", "PayIn"."genesisId", "PayIn"."successorId", "PayIn"."benefactorId", "PayIn"."userId"
    ${orderBy}`
}
