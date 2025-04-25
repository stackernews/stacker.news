import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'
import { notifyZapped } from '@/lib/webPush'
import { createUserInvoice, getInvoiceableWallets } from '@/wallets/server'
import { Prisma } from '@prisma/client'
import { parsePaymentRequest } from 'ln-service'

export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P,
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

async function getInvoiceablePeer (models, { id, sats, hasSendWallet }, { me }) {
  const zapper = await models.user.findUnique({ where: { id: me.id } })
  // if the zap is dust, or if me doesn't have a send wallet but has enough sats/credits to pay for it
  // then we don't invoice the peer
  if (sats < zapper?.sendCreditsBelowSats ||
    (me && !hasSendWallet && (zapper.mcredits + zapper.msats >= satsToMsats(sats)))) {
    return null
  }

  const item = await models.item.findUnique({
    where: { id: parseInt(id) },
    include: {
      itemForwards: true,
      user: true
    }
  })

  // bios don't get sats
  if (item.bio) {
    return null
  }

  const wallets = await getInvoiceableWallets(item.userId, { models })

  // request peer invoice if they have an attached wallet and have not forwarded the item
  // and the receiver doesn't want to receive credits
  if (wallets.length > 0 &&
    item.itemForwards.length === 0 &&
    sats >= item.user.receiveCreditsBelowSats) {
    return item.userId
  }

  return null
}

// 70% to the receiver(s), 21% to the territory founder, the rest depends on if it's P2P or not
export async function getInitial (models, payInArgs, { me }) {
  const { sub, itemForwards, userId } = await models.item.findUnique({ where: { id: parseInt(payInArgs.id) }, include: { sub: true, itemForwards: true, user: true } })
  const mcost = satsToMsats(payInArgs.sats)
  const founderMtokens = mcost * 21n / 100n
  const payOutCustodialTokens = [{
    payOutType: 'TERRITORY_REVENUE',
    userId: sub.userId,
    mtokens: founderMtokens,
    custodialTokenType: 'SATS'
  }]

  let payOutBolt11
  const invoiceablePeer = await getInvoiceablePeer(models, payInArgs, { me })
  if (invoiceablePeer) {
    const routingFeeMtokens = mcost * 3n / 100n
    const rewardsPoolMtokens = mcost * 6n / 100n
    const zapMtokens = mcost - routingFeeMtokens - rewardsPoolMtokens
    const { invoice: bolt11, wallet } = await createUserInvoice(me.id, { msats: zapMtokens }, { models })
    const invoice = await parsePaymentRequest({ request: bolt11 })

    // 6% to rewards pool, 3% to routing fee
    payOutCustodialTokens.push(
      { payOutType: 'ROUTING_FEE', userId: null, mtokens: routingFeeMtokens, custodialTokenType: 'SATS' },
      { payOutType: 'REWARDS_POOL', userId: null, mtokens: rewardsPoolMtokens, custodialTokenType: 'SATS' })
    payOutBolt11 = {
      payOutType: 'ZAP',
      msats: BigInt(invoice.mtokens),
      bolt11,
      hash: invoice.hash,
      userId: invoiceablePeer,
      walletId: wallet.id
    }
  } else {
    // 9% to rewards pool
    const rewardsPoolMtokens = mcost * 9n / 100n
    const zapMtokens = mcost - rewardsPoolMtokens - founderMtokens
    if (itemForwards.length > 0) {
      for (const f of itemForwards) {
        payOutCustodialTokens.push({ payOutType: 'ZAP', userId: f.userId, mtokens: zapMtokens * BigInt(f.pct) / 100n, custodialTokenType: 'CREDITS' })
      }
    }
    const remainingZapMtokens = zapMtokens - payOutCustodialTokens.filter(t => t.payOutType === 'ZAP').reduce((acc, t) => acc + t.mtokens, 0n)
    payOutCustodialTokens.push({ payOutType: 'ZAP', userId, mtokens: remainingZapMtokens, custodialTokenType: 'CREDITS' })
  }

  return {
    payInType: 'ZAP',
    userId: me.id,
    mcost,
    payOutCustodialTokens,
    payOutBolt11,
    itemPayIn: {
      itemId: parseInt(payInArgs.id)
    }
  }
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  await tx.itemPayIn.update({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({
    where: { id: payInId },
    include: {
      itemPayIn: { include: { item: true } },
      payOutBolt11: true
    }
  })

  const msats = payIn.mcost
  const sats = msatsToSats(msats)
  const userId = payIn.userId
  const item = payIn.itemPayIn.item

  // perform denomormalized aggregates: weighted votes, upvotes, msats, lastZapAt
  // NOTE: for the rows that might be updated by a concurrent zap, we use UPDATE for implicit locking
  await tx.$queryRaw`
    WITH territory AS (
      SELECT COALESCE(r."subName", i."subName", 'meta')::CITEXT as "subName"
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
        mcredits = "Item".mcredits + ${payIn.payOutBolt11 ? 0n : msats}::BIGINT,
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
      "commentMcredits" = "Item"."commentMcredits" + ${payIn.payOutBolt11 ? 0n : msats}::BIGINT
    FROM item_zapped, ancestors
    WHERE "Item".id = ancestors.id`

  // record potential bounty payment
  // NOTE: we are at least guaranteed that we see the update "ItemUserAgg" from our tx so we can trust
  // we won't miss a zap that aggregates into a bounty payment, regardless of the order of updates
  await tx.$executeRaw`
    WITH bounty AS (
      SELECT root.id, "ItemUserAgg"."zapSats" >= root.bounty AS paid, "ItemUserAgg"."itemId" AS target
      FROM "ItemUserAgg"
      JOIN "Item" ON "Item".id = "ItemUserAgg"."itemId"
      LEFT JOIN "Item" root ON root.id = "Item"."rootId"
      WHERE "ItemUserAgg"."userId" = ${userId}::INTEGER
      AND "ItemUserAgg"."itemId" = ${item.id}::INTEGER
      AND root."userId" = ${userId}::INTEGER
      AND root.bounty IS NOT NULL
    )
    UPDATE "Item"
    SET "bountyPaidTo" = array_remove(array_append(array_remove("bountyPaidTo", bounty.target), bounty.target), NULL)
    FROM bounty
    WHERE "Item".id = bounty.id AND bounty.paid`
}

export async function onPaidSideEffects (models, payInId) {
  const payIn = await models.payIn.findUnique({
    where: { id: payInId },
    include: { itemPayIn: { include: { item: true } } }
  })
  // avoid duplicate notifications with the same zap amount
  // by checking if there are any other pending acts on the item
  const pendingActs = await models.itemAct.count({
    where: {
      itemId: payIn.itemPayIn.itemId,
      createdAt: {
        gt: payIn.createdAt
      }
    }
  })
  if (pendingActs === 0) notifyZapped({ models, item: payIn.itemPayIn.item }).catch(console.error)
}

export async function describe (models, payInId, { me }) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { itemPayIn: true } })
  return `SN: zap ${numWithUnits(payIn.mcost, { abbreviate: false })} #${payIn.itemPayIn.itemId}`
}
