import { PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'
import { notifyZapped } from '@/lib/webPush'
import { Prisma } from '@prisma/client'
import { payOutBolt11Prospect } from '../lib/payOutBolt11'
import { getItemResult, getSubs } from '../lib/item'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'
import { canWrapBolt11 } from '@/wallets/server'

export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P,
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

async function tryP2P (models, { sats, hasSendWallet }, { me }, item) {
  if (me.id !== USER_ID.anon) {
    const zapper = await models.user.findUnique({ where: { id: me.id } })
    if (sats < zapper?.sendCreditsBelowSats ||
      (!hasSendWallet && (zapper.mcredits + zapper.msats >= satsToMsats(sats)))) {
      return false
    }
  }

  if (item.bio || item.freebie) {
    return false
  }

  return true
}

// 70% to the receiver(s)
// if sub, 21% to the territory founder
//    if p2p, 6% to rewards pool, 3% to routing fee
//    if not p2p, all 9% to rewards pool
// if not sub
//    if p2p, 27% to rewards pool, 3% to routing fee
//    if not p2p, all 30% to rewards pool
export async function getInitial (models, payInArgs, { me }) {
  const item = await models.item.findUnique({ where: { id: parseInt(payInArgs.id) }, include: { itemForwards: { include: { user: true } }, user: true } })
  const { subNames, parentId, itemForwards, userId, user } = item
  const subs = await getSubs(models, { subNames, parentId })
  const mcost = satsToMsats(payInArgs.sats)
  let payOutBolt11

  const zapMtokens = mcost * 70n / 100n
  const payOutCustodialTokensProspects = []

  // build unified candidate list: explicit forwards + author's implicit remaining share
  const authorPct = 100 - itemForwards.reduce((acc, f) => acc + f.pct, 0)
  const candidates = [
    ...itemForwards.map(f => ({ userId: f.userId, pct: f.pct, receiveCreditsBelowSats: f.user.receiveCreditsBelowSats })),
    ...(authorPct > 0 ? [{ userId, pct: authorPct, receiveCreditsBelowSats: user.receiveCreditsBelowSats }] : [])
  ].filter(c => c.userId !== USER_ID.anon && c.userId !== USER_ID.rewards && c.userId !== USER_ID.saloon)
    .sort((a, b) => b.pct - a.pct)

  let p2pCandidateUserId = null
  const p2p = await tryP2P(models, payInArgs, { me }, item)
  if (p2p) {
    for (const c of candidates) {
      const candidateMtokens = zapMtokens * BigInt(c.pct) / 100n
      if (msatsToSats(candidateMtokens) < c.receiveCreditsBelowSats) continue

      const routingFeeMtokens = candidateMtokens * 3n / 70n
      try {
        let testBolt11Func
        // anon and users without a send wallet can't auto-retry, so we test the invoice before proceeding with p2p
        if (me.id === USER_ID.anon || !payInArgs.hasSendWallet) {
          testBolt11Func = async (bolt11) => await canWrapBolt11({ msats: candidateMtokens, bolt11, maxRoutingFeeMsats: routingFeeMtokens })
        }

        payOutBolt11 = await payOutBolt11Prospect(models, { msats: candidateMtokens, description: 'SN: zap to item #' + parseInt(payInArgs.id) }, { userId: c.userId, payOutType: 'ZAP' }, testBolt11Func)
        p2pCandidateUserId = c.userId
        // some wallets truncate msats to sats, so base the routing fee on the actual bolt11 amount
        payOutCustodialTokensProspects.push({ payOutType: 'ROUTING_FEE', userId: null, mtokens: payOutBolt11.msats * 3n / 70n, custodialTokenType: 'SATS' })
        break
      } catch (err) {
        console.error('failed to create invoice for candidate:', err)
      }
    }
  }

  // distribute CCs to all candidates who didn't get P2P
  for (const c of candidates) {
    if (c.userId === p2pCandidateUserId) continue
    payOutCustodialTokensProspects.push({ payOutType: 'ZAP', userId: c.userId, mtokens: zapMtokens * BigInt(c.pct) / 100n, custodialTokenType: 'CREDITS' })
  }

  // what's left goes to the rewards pool
  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({ subs, mcost, payOutCustodialTokens: payOutCustodialTokensProspects, payOutBolt11 })

  return {
    payInType: 'ZAP',
    userId: me.id,
    mcost,
    itemPayIn: { itemId: parseInt(payInArgs.id) },
    payOutCustodialTokens,
    payOutBolt11
  }
}

export async function onBegin (tx, payInId, payInArgs) {
  const item = await getItemResult(tx, { id: payInArgs.id })
  return { id: item.id, path: item.path, sats: payInArgs.sats, act: 'TIP' }
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  const { itemId, payIn } = await tx.itemPayIn.findUnique({ where: { payInId: oldPayInId }, include: { payIn: true } })
  const item = await getItemResult(tx, { id: itemId })
  return { id: item.id, path: item.path, sats: msatsToSats(payIn.mcost), act: 'TIP' }
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({
    where: { id: payInId },
    include: {
      itemPayIn: { include: { item: true } },
      payOutBolt11: true,
      payOutCustodialTokens: true
    }
  })

  const msats = payIn.mcost
  const sats = msatsToSats(msats)
  const userId = payIn.userId
  const item = payIn.itemPayIn.item
  const p2pMsats = payIn.payOutBolt11?.msats ?? 0n
  // actual recipient msats = p2p bolt11 + custodial ZAP payouts
  // (ineligible authors have their share redistributed, so this can be less than 70%)
  const recipientMsats = p2pMsats + payIn.payOutCustodialTokens
    .filter(t => t.payOutType === 'ZAP')
    .reduce((acc, t) => acc + t.mtokens, 0n)
  // scale mcost by the recipient's p2p share to determine how much of the zap is credits vs sats
  const creditMsats = recipientMsats > 0n ? msats - msats * p2pMsats / recipientMsats : msats

  // perform denomormalized aggregates: weighted votes, upvotes, msats, lastZapAt
  // NOTE: for the rows that might be updated by a concurrent zap, we use UPDATE for implicit locking
  // NOTE: ancestors are ORDER BY id for consistent lock ordering to prevent deadlocks
  // XXX we base the zap weight on the first sub in the subNames array
  // this is mostly a placeholder becasue we are running a no trust experiment
  // if we use trust again, we'll need an approach to this for multiple territories
  await tx.$queryRaw`
    WITH territory AS (
      SELECT COALESCE(r."subNames"[1], i."subNames"[1], 'meta')::CITEXT as "subName"
      FROM "Item" i
      LEFT JOIN "Item" r ON r.id = i."rootId"
      WHERE i.id = ${item.id}::INTEGER
    ), zapper AS (
      SELECT
        COALESCE(${item.parentId
          ? Prisma.sql`"zapCommentTrust"`
          : Prisma.sql`"zapPostTrust"`}, 0) as "zapTrust",
        COALESCE(${item.parentId
          ? Prisma.sql`"subZapCommentTrust"`
          : Prisma.sql`"subZapPostTrust"`}, 0) as "subZapTrust"
      FROM territory
      LEFT JOIN "UserSubTrust" ust ON ust."subName" = territory."subName"
        AND ust."userId" = ${userId}::INTEGER
    ), zap AS (
      INSERT INTO "ItemUserAgg" ("userId", "itemId", "zapSats")
      VALUES (${userId}::INTEGER, ${item.id}::INTEGER, ${sats}::INTEGER)
      ON CONFLICT ("itemId", "userId") DO UPDATE
      SET "zapSats" = "ItemUserAgg"."zapSats" + ${sats}::INTEGER, updated_at = now()
      RETURNING ("zapSats" = ${sats}::INTEGER)::INTEGER as first_vote,
        LOG("zapSats" / GREATEST("zapSats" - ${sats}::INTEGER, 1)::FLOAT) AS log_sats
    ), item_zapped AS (
      UPDATE "Item"
      SET
        "weightedVotes" = "weightedVotes" + zapper."zapTrust" * zap.log_sats,
        "subWeightedVotes" = "subWeightedVotes" + zapper."subZapTrust" * zap.log_sats,
        upvotes = upvotes + zap.first_vote,
        msats = "Item".msats + ${msats}::BIGINT,
        mcredits = "Item".mcredits + ${creditMsats}::BIGINT,
        "lastZapAt" = now()
      FROM zap, zapper
      WHERE "Item".id = ${item.id}::INTEGER
      RETURNING "Item".*, zapper."zapTrust" * zap.log_sats as "weightedVote"
    ), ancestors AS (
      SELECT "Item".*
      FROM "Item", item_zapped
      WHERE "Item".path @> item_zapped.path AND "Item".id <> item_zapped.id
      ORDER BY "Item".id
    )
    UPDATE "Item"
    SET "weightedComments" = "Item"."weightedComments" + item_zapped."weightedVote",
      "commentMsats" = "Item"."commentMsats" + ${msats}::BIGINT,
      "commentMcredits" = "Item"."commentMcredits" + ${creditMsats}::BIGINT
    FROM item_zapped, ancestors
    WHERE "Item".id = ancestors.id`
}

export async function onPaidSideEffects (models, payInId) {
  const payIn = await models.payIn.findUnique({
    where: { id: payInId },
    include: { itemPayIn: { include: { item: true } } }
  })
  // avoid duplicate notifications with the same zap amount
  // by checking if there are any other pending acts on the item
  const pendingZaps = await models.itemPayIn.count({
    where: {
      itemId: payIn.itemPayIn.itemId,
      payIn: {
        payInType: 'ZAP',
        createdAt: {
          gt: payIn.createdAt
        }
      }
    }
  })
  if (pendingZaps === 0) notifyZapped({ models, item: payIn.itemPayIn.item }).catch(console.error)
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { itemPayIn: true } })
  return `SN: zap ${numWithUnits(msatsToSats(payIn.mcost), { abbreviate: false })} #${payIn.itemPayIn.itemId}`
}
