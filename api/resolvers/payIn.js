import { USER_ID, PAY_IN_NOTIFICATION_TYPES, WALLET_MAX_RETRIES, WALLET_RETRY_BEFORE_MS } from '@/lib/constants'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { verifyHmac } from './wallet'
import { payInCancel, payInFailed } from '../payIn/transitions'
import { retry } from '../payIn'
import { payInTypesSql } from '../payIn/lib/sql'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { getItem, getItemsById } from './item'
import { getSub } from './sub'
import { parseWalletId } from '@/wallets/server/resolvers/util'
import { Prisma } from '@prisma/client'
import { externalTransactionInclude } from '@/wallets/server/external-transactions'

function payInResultType (payInType) {
  switch (payInType) {
    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
    case 'BOUNTY_PAYMENT':
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

async function hydratePayInItems (payIns, { me, models }) {
  const visibleItemPayIns = payIns.filter(payIn =>
    payIn.itemPayIn && !(!isMine(payIn, { me }) && payIn.payInType === 'DOWN_ZAP'))
  if (visibleItemPayIns.length === 0) return

  const items = await getItemsById(
    visibleItemPayIns.map(payIn => payIn.itemPayIn.itemId),
    { me, models }
  )
  const itemMap = new Map(items.map(item => [Number(item.id), item]))

  for (const payIn of visibleItemPayIns) {
    payIn.item = itemMap.get(Number(payIn.itemPayIn.itemId)) || null
  }
}

// The PayIn timeline used by `satistics`: a send branch (rows created at pay-in) UNION a receive
// branch (rows the user is paid out on). It emits only timeline keys; full rows are hydrated after
// Postgres merges and pages the combined wallet activity stream.
function walletPayInTimelineKeyQuery ({ userId, time, limit, authorizedProtocolIds }) {
  const walletSendFilter = authorizedProtocolIds
    ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "PayInBolt11"
          WHERE "PayInBolt11"."payInId" = "PayIn"."id"
          AND "PayInBolt11"."protocolId" IN (${Prisma.join(authorizedProtocolIds)})
        )`
    : Prisma.empty
  const walletReceiveFilter = authorizedProtocolIds
    ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "PayOutBolt11"
          WHERE "PayOutBolt11"."payInId" = "PayIn"."id"
          AND "PayOutBolt11"."protocolId" IN (${Prisma.join(authorizedProtocolIds)})
        )`
    : Prisma.empty
  const receivePredicate = authorizedProtocolIds
    ? Prisma.sql`AND "PayIn"."payInState" = 'PAID'`
    : Prisma.sql`AND ${myReceivePredicate({ userId })}`

  return Prisma.sql`
    SELECT 'PAYIN' AS src, p.id, p."sortTime", p."isSend"
    FROM (
      (
        SELECT "PayIn".id, "PayIn"."created_at" as "sortTime", true as "isSend"
        FROM "PayIn"
        WHERE "PayIn"."userId" = ${userId}
        AND "PayIn"."benefactorId" IS NULL
        AND "PayIn"."mcost" > 0
        AND "PayIn"."payInType" NOT IN ('PROXY_PAYMENT')
        AND "PayIn"."created_at" <= ${time}
        ${walletSendFilter}
        ORDER BY "sortTime" DESC, "PayIn"."id" DESC
        LIMIT ${limit}
      )
      UNION ALL
      (
        SELECT "PayIn".id, "PayIn"."payInStateChangedAt" as "sortTime", false as "isSend"
        FROM "PayIn"
        WHERE "PayIn"."benefactorId" IS NULL
        AND "PayIn"."mcost" > 0
        AND "PayIn"."payInStateChangedAt" <= ${time}
        ${walletReceiveFilter}
        ${receivePredicate}
        ORDER BY "sortTime" DESC, "PayIn"."id" DESC
        LIMIT ${limit}
      )
      -- "id" DESC is a unique tiebreak so the LIMIT/OFFSET cutoff is deterministic
      -- (otherwise tied-timestamp rows at a page boundary can be skipped or duplicated across pages).
      ORDER BY "sortTime" DESC, "isSend" ASC, "id" DESC
      LIMIT ${limit}
    ) p`
}

function myReceivePredicate ({ userId }) {
  return Prisma.sql`(
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
  )`
}

function externalTransactionTimelineKeyQuery ({ userId, time, limit, walletIdNumber }) {
  const walletFilter = walletIdNumber !== null
    ? Prisma.sql`AND "walletId" = ${walletIdNumber}`
    : Prisma.empty

  return Prisma.sql`
    SELECT 'EXT' AS src, "ExternalTransaction".id,
           "created_at" AS "sortTime", "direction" = 'SEND' AS "isSend"
    FROM "ExternalTransaction"
    WHERE "userId" = ${userId}
      ${walletFilter}
      AND "created_at" <= ${time}
    ORDER BY "created_at" DESC, ("direction" = 'SEND') ASC, "id" DESC
    LIMIT ${limit}`
}

// Hydrate a page of wallet-activity sort keys into full, ordered rows. PayIn and
// ExternalTransaction live in separate tables (the union merges only their sort keys), so each
// is fetched by id, indexed by `src:id`, then the keys are walked in order to re-interleave the two.
// One PayIn can surface under two keys (its send and receive rows), so it's spread fresh per key.
async function hydrateWalletActivity (keys, { me, models }) {
  const idsFor = src => keys.filter(k => k.src === src).map(k => Number(k.id))
  const payInIds = idsFor('PAYIN')
  const extIds = idsFor('EXT')

  const [payIns, exts] = await Promise.all([
    // Prisma.join throws on an empty list, so skip the query when the page has no PayIn keys
    payInIds.length
      ? getPayInFull({ models, query: Prisma.sql`SELECT * FROM "PayIn" WHERE "id" IN (${Prisma.join(payInIds)})` })
      : [],
    extIds.length
      ? models.externalTransaction.findMany({ where: { id: { in: extIds } }, include: externalTransactionInclude() })
      : []
  ])

  // attach items to the fetched PayIns (one batched getItemsById) before indexing, so the spreads
  // below carry `.item` into every copy — including a PayIn that surfaces under both its send/receive keys
  await hydratePayInItems(payIns, { me, models })

  const rowByKey = new Map()
  for (const payIn of payIns) rowByKey.set(`PAYIN:${Number(payIn.id)}`, { ...payIn, __typename: 'PayIn' })
  for (const tx of exts) rowByKey.set(`EXT:${Number(tx.id)}`, { ...tx, __typename: 'ExternalTransaction' })

  return keys
    .map(({ src, id, sortTime, isSend }) => {
      const row = rowByKey.get(`${src}:${Number(id)}`)
      return row && { ...row, sortTime, isSend }
    })
    .filter(Boolean)
}

function walletInfoFromProtocol (protocol, role) {
  return {
    walletId: protocol.wallet.id,
    walletName: protocol.wallet.template.name,
    protocolId: protocol.id,
    protocolName: protocol.name,
    role
  }
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
    satistics: async (parent, { cursor, walletId }, { models, me }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      const userId = me.id
      const walletIdNumber = walletId != null ? parseWalletId(walletId) : null

      // When filtering by wallet, pre-resolve the wallet's protocol IDs once
      // (with explicit ownership)
      let authorizedProtocolIds = null
      if (walletIdNumber !== null) {
        const protocols = await models.walletProtocol.findMany({
          where: { walletId: walletIdNumber, wallet: { userId } },
          select: { id: true }
        })
        if (protocols.length === 0) {
          // Wallet does not exist, is not owned by the caller, or has no
          // protocols. Either way, there is no activity to surface.
          return { txs: [], cursor: null }
        }
        authorizedProtocolIds = protocols.map(p => p.id)
      }

      const decodedCursor = decodeCursor(cursor)
      const offset = decodedCursor.offset
      const limit = LIMIT
      const queryLimit = limit + offset
      const time = decodedCursor.time

      const keys = await models.$queryRaw`
        SELECT src, id, "sortTime", "isSend"
        FROM (
          (
            ${walletPayInTimelineKeyQuery({
              userId,
              time,
              limit: queryLimit,
              authorizedProtocolIds
            })}
          )
          UNION ALL
          (
            ${externalTransactionTimelineKeyQuery({
              userId,
              time,
              limit: queryLimit,
              walletIdNumber
            })}
          )
        ) merged
        ORDER BY "sortTime" DESC, "isSend" ASC, id DESC, src DESC
        OFFSET ${offset} LIMIT ${limit}`

      const txs = await hydrateWalletActivity(keys, { me, models })

      return {
        txs,
        // page-fullness comes from the sort-key page, not the hydrated rows: stitching drops any key
        // whose row vanished between the two queries, which must not prematurely end pagination
        cursor: keys.length === LIMIT ? nextCursorEncoded(decodedCursor) : null
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
          AND "PayIn"."payInType" IN (${payInTypesSql(PAY_IN_NOTIFICATION_TYPES)})
          AND "PayIn"."userId" = ${me.id}
          AND "PayIn"."successorId" IS NULL
          AND "PayIn"."benefactorId" IS NULL
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
    retryPayIn: async (parent, { payInId, sendProtocolId }, { models, me }) => {
      return await retry(payInId, { me, sendProtocolId })
    }
  },
  WalletActivityItem: {
    // satistics stamps __typename on every item it returns
    __resolveType: item => item.__typename
  },
  ExternalTransaction: {
    walletInfo: (transaction, args, { me }) => {
      if (!me || Number(me.id) === USER_ID.anon) {
        return null
      }
      // protocol (with wallet + template) is always loaded via externalTransactionInclude()
      const { protocol } = transaction
      if (!protocol) return null

      return walletInfoFromProtocol(protocol, transaction.direction)
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
      return { msats: payIn.payInBolt11?.msatsReceived ?? payIn.payInBolt11?.msatsRequested }
    },
    payOutBolt11Public: (payIn, args, { models, me }) => {
      if (!payIn.payOutBolt11) {
        return null
      }
      return { msats: payIn.payOutBolt11?.msats }
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
      if (typeof payIn.item !== 'undefined') {
        return payIn.item
      }
      return await getItem(payIn, { id: payIn.itemPayIn.itemId }, { me, models })
    },
    walletInfo: async (payIn, args, { models, me }) => {
      if (typeof payIn.walletInfo !== 'undefined') {
        return payIn.walletInfo
      }
      if (!me || Number(me.id) === USER_ID.anon) {
        return null
      }

      const protocolCandidates = [
        { protocolId: payIn.payInBolt11?.protocolId, role: 'SEND' },
        { protocolId: payIn.payOutBolt11?.protocolId, role: 'RECEIVE' }
      ]
        .filter(({ protocolId }) => protocolId)
        .map(({ protocolId, role }) => ({ protocolId: Number(protocolId), role }))

      if (!protocolCandidates.length) {
        return null
      }

      const protocols = await models.walletProtocol.findMany({
        where: {
          id: {
            in: protocolCandidates.map(({ protocolId }) => protocolId)
          },
          wallet: {
            userId: Number(me.id)
          }
        },
        include: {
          wallet: {
            include: {
              template: true
            }
          }
        }
      })

      for (const { protocolId, role } of protocolCandidates) {
        const protocol = protocols.find(protocol => protocol.id === protocolId)
        if (!protocol) continue

        return walletInfoFromProtocol(protocol, role)
      }

      return null
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
        const meId = Number(me.id)
        const myReward = payOutCustodialTokens.find(t => t.payOutType === 'REWARD' && Number(t.userId) === Number(meId))
        const remainingOtherReward = payOutCustodialTokens.find(t => t.payOutType === 'REWARD' && Number(t.userId) !== Number(meId))
        const visibleRewards = myReward ? [myReward] : []
        if (remainingOtherReward) {
          const remainingRewardMtokens = BigInt(payIn.mcost) - BigInt(myReward?.mtokens ?? 0)
          if (remainingRewardMtokens > 0) {
            visibleRewards.push({
              id: remainingOtherReward.id,
              payOutType: 'REWARD',
              mtokens: remainingRewardMtokens,
              custodialTokenType: 'SATS'
            })
          }
        }
        return visibleRewards
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
      if (!isMine(payOutCustodialToken, { me }) && payOutCustodialToken.payOutType !== 'ZAP') {
        return null
      }
      return payOutCustodialToken
    },
    sub: async (payOutCustodialToken, args, { models }) => {
      if (payOutCustodialToken.sub) {
        return payOutCustodialToken.sub
      }
      if (payOutCustodialToken.subPayOutCustodialToken) {
        return payOutCustodialToken.subPayOutCustodialToken.sub
      }
      if (payOutCustodialToken.subId == null) {
        return null
      }
      return await models.sub.findUnique({ where: { id: payOutCustodialToken.subId } })
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
        const __typename = payInResultType(payIn.payInType)
        if (payIn.payInType === 'BOUNTY_PAYMENT' && __typename === 'Item') {
          // Bounty result items should not carry item-creation payIn metadata.
          return { ...result, payIn: null, __typename }
        }
        return { ...result, __typename }
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
                          JOIN "Sub" s ON s."id" = spo."subId"
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
                          SELECT COALESCE(jsonb_agg(to_jsonb(po.*)
                            || jsonb_build_object('user', to_jsonb(u.*),
                            'subPayOutCustodialToken',
                              (SELECT to_jsonb(spo.*) || jsonb_build_object('sub', to_jsonb(s.*))
                                FROM "SubPayOutCustodialToken" spo
                                JOIN "Sub" s ON s."id" = spo."subId"
                                WHERE spo."payOutCustodialTokenId" = po.id
                                LIMIT 1
                              )
                            )
                          ORDER BY po.id), '[]'::jsonb)
                          FROM "PayOutCustodialToken" po
                          LEFT JOIN users u ON u.id = po."userId"
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
