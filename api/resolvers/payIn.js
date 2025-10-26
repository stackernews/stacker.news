import { USER_ID, WALLET_MAX_RETRIES, WALLET_RETRY_BEFORE_MS } from '@/lib/constants'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { verifyHmac } from './wallet'
import { payInCancel, payInFailed } from '../payIn/transitions'
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
  const meId = me?.id ?? USER_ID.anon
  return Number(meId) === Number(payIn.userId)
}

export async function getPayIn (parent, { id }, { me, models }) {
  const payIn = (await getPayInFull({
    models,
    query: Prisma.sql`SELECT * FROM "PayIn" WHERE "PayIn"."id" = ${id}`
  }))[0]

  if (!payIn) {
    throw new Error('PayIn not found')
  }

  const meId = me?.id ?? USER_ID.anon
  if (Number(payIn.userId) !== Number(meId) &&
    !payIn.payOutCustodialTokens.some(token => Number(token.userId) === Number(meId)) &&
    Number(payIn.payOutBolt11?.userId) !== Number(meId)) {
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
            AND "PayIn"."payInType" NOT IN ('PROXY_PAYMENT')
            AND "PayIn"."created_at" <= ${decodedCursor.time}
            ORDER BY "sortTime" DESC
            LIMIT ${limit + offset}
          )
          UNION ALL
          (
            SELECT "PayIn".*, "payInStateChangedAt" as "sortTime", false as "isSend"
            FROM "PayIn"
            WHERE "PayIn"."benefactorId" IS NULL
            AND "PayIn"."mcost" > 0
            AND "PayIn"."payInStateChangedAt" <= ${decodedCursor.time}
            AND (
              EXISTS (
                SELECT 1
                FROM "RefundCustodialToken"
                WHERE "RefundCustodialToken"."payInId" = "PayIn"."id" AND "PayIn"."userId" = ${userId}
              ) OR
              EXISTS (
                SELECT 1
                FROM "PayOutBolt11"
                WHERE "PayOutBolt11"."payInId" = "PayIn"."id" AND "PayOutBolt11"."userId" = ${userId}
                AND "PayIn"."payInState" = 'PAID'
              ) OR
              EXISTS (
                SELECT 1
                FROM "PayOutCustodialToken"
                WHERE "PayOutCustodialToken"."payInId" = "PayIn"."id" AND "PayOutCustodialToken"."userId" = ${userId}
                AND "PayIn"."payInState" = 'PAID'
              )
            )
            ORDER BY "sortTime" DESC
            LIMIT ${limit + offset}
          )
          ORDER BY "sortTime" DESC
          OFFSET ${offset}
          LIMIT ${limit}`,
        orderBy: Prisma.sql`ORDER BY "sortTime" DESC`
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
          AND "PayIn"."retryCount" < ${WALLET_MAX_RETRIES}
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
      await payInCancel({
        data: {
          payInId: payInBolt11.payInId,
          payInFailureReason: userCancel ? 'USER_CANCELLED' : 'SYSTEM_CANCELLED'
        },
        models,
        me,
        boss,
        lnd
      })
      return await payInFailed({
        data: {
          payInId: payInBolt11.payInId
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

async function getPayInFull ({ models, query, orderBy = Prisma.empty }) {
  return await models.$queryRaw`
    WITH payins AS (
      ${query}
    )
    SELECT
      p.*,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt",
      pe."pessimisticEnv",
      ip."itemPayIn",
      sp."subPayIn",
      pib."payInBolt11",
      pob."payOutBolt11",
      pic."payInCustodialTokens",
      poct."payOutCustodialTokens",
      b."beneficiaries",
      rct."refundCustodialTokens"
    FROM payins p
    LEFT JOIN LATERAL (
      SELECT to_jsonb(x.*) AS "pessimisticEnv"
      FROM "PessimisticEnv" x
      WHERE x."payInId" = p.id
      ORDER BY x.id
      LIMIT 1
    ) pe ON true
    LEFT JOIN LATERAL (
      SELECT to_jsonb(x.*) AS "itemPayIn"
      FROM "ItemPayIn" x
      WHERE x."payInId" = p.id
      ORDER BY x.id
      LIMIT 1
    ) ip ON true
    LEFT JOIN LATERAL (
      SELECT to_jsonb(x.*) AS "subPayIn"
      FROM "SubPayIn" x
      WHERE x."payInId" = p.id
      ORDER BY x.id
      LIMIT 1
    ) sp ON true
    LEFT JOIN LATERAL (
      SELECT
        to_jsonb(pib.*)
        || jsonb_build_object(
            'lud18Data',  to_jsonb(pibl.*),
            'nostrNote',  to_jsonb(pin.*),
            'comment',    to_jsonb(picm.*)
          ) AS "payInBolt11"
      FROM "PayInBolt11" pib
      LEFT JOIN "PayInBolt11Lud18"     pibl ON pibl."payInBolt11Id" = pib.id
      LEFT JOIN "PayInBolt11NostrNote" pin  ON pin."payInBolt11Id"  = pib.id
      LEFT JOIN "PayInBolt11Comment"   picm ON picm."payInBolt11Id" = pib.id
      WHERE pib."payInId" = p.id
      ORDER BY pib.id
      LIMIT 1
    ) pib ON true
    LEFT JOIN LATERAL (
      SELECT
        to_jsonb(ob.*) || jsonb_build_object('user', to_jsonb(u.*)) AS "payOutBolt11"
      FROM "PayOutBolt11" ob
      JOIN users u ON u.id = ob."userId"
      WHERE ob."payInId" = p.id
      ORDER BY ob.id
      LIMIT 1
    ) pob ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(jsonb_agg(to_jsonb(x.*) ORDER BY x.id), '[]'::jsonb) AS "payInCustodialTokens"
      FROM "PayInCustodialToken" x
      WHERE x."payInId" = p.id
    ) pic ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(
              jsonb_agg(
                to_jsonb(o.*)
                || jsonb_build_object(
                      'user',
                        to_jsonb(u.*) || jsonb_build_object('invite', to_jsonb(inv.*)),
                      'subPayOutCustodialToken',
                        (
                          SELECT to_jsonb(spo.*) || jsonb_build_object('sub', to_jsonb(s.*))
                          FROM "SubPayOutCustodialToken" spo
                          JOIN "Sub" s ON s."name" = spo."subName"
                          WHERE spo."payOutCustodialTokenId" = o.id
                          LIMIT 1
                        )
                    )
                ORDER BY o.id
              ),
              '[]'::jsonb
            ) AS "payOutCustodialTokens"
      FROM "PayOutCustodialToken" o
      LEFT JOIN users u      ON u.id = o."userId"
      LEFT JOIN "Invite" inv ON inv.id = u."inviteId"
      WHERE o."payInId" = p.id
    ) poct ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(
              jsonb_agg(
                to_jsonb(benef.*)
                || jsonb_build_object(
                      'payOutCustodialTokens',
                        (
                          SELECT COALESCE(jsonb_agg(to_jsonb(po.*) ORDER BY po.id), '[]'::jsonb)
                          FROM "PayOutCustodialToken" po
                          WHERE po."payInId" = benef.id
                        )
                    )
                ORDER BY benef.id
              ),
              '[]'::jsonb
            ) AS "beneficiaries"
      FROM "PayIn" benef
      WHERE benef."benefactorId" = p.id
    ) b ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(jsonb_agg(to_jsonb(x.*) ORDER BY x.id), '[]'::jsonb) AS "refundCustodialTokens"
      FROM "RefundCustodialToken" x
      WHERE x."payInId" = p.id
    ) rct ON true
    ${orderBy}`
}
