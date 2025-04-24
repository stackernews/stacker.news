import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { msatsToSats, satsToMsats } from '@/lib/format'
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

export async function getInvoiceablePeer (models, { id, sats, hasSendWallet }, { me }) {
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

// 70% to the receiver, 21% to the territory founder, 6% to rewards pool, 3% to routing fee
export async function getInitial (models, payInArgs, { me }) {
  const mcost = satsToMsats(payInArgs.sats)
  const routingFeeMtokens = mcost * 3n / 100n
  const rewardsPoolMtokens = mcost * 6n / 100n
  const zapMtokens = mcost - routingFeeMtokens - rewardsPoolMtokens
  const payOutCustodialTokens = [
    { payOutType: 'ROUTING_FEE', userId: null, mtokens: routingFeeMtokens, custodialTokenType: 'SATS' },
    { payOutType: 'REWARDS_POOL', userId: null, mtokens: rewardsPoolMtokens, custodialTokenType: 'SATS' }
  ]

  let payOutBolt11
  const invoiceablePeer = await getInvoiceablePeer(models, payInArgs, { me })
  if (invoiceablePeer) {
    const { invoice: bolt11, wallet } = await createUserInvoice(me.id, { msats: zapMtokens }, { models })
    const invoice = await parsePaymentRequest({ request: bolt11 })
    payOutBolt11 = {
      payOutType: 'ZAP',
      msats: BigInt(invoice.mtokens),
      bolt11: invoice.bolt11,
      hash: invoice.hash,
      userId: invoiceablePeer,
      walletId: wallet.id
    }
  } else {
    const item = await models.item.findUnique({ where: { id: parseInt(payInArgs.id) } })
    payOutCustodialTokens.push({ payOutType: 'ZAP', userId: item.userId, mtokens: zapMtokens, custodialTokenType: 'SATS' })
  }

  return {
    payInType: 'ZAP',
    userId: me.id,
    mcost,
    payOutCustodialTokens,
    payOutBolt11
  }
}

export async function onBegin (tx, payInId, { sats, id }, { me }) {
  await tx.itemPayIn.create({
    data: {
      itemId: parseInt(id),
      payInId
    }
  })
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  await tx.itemAct.update({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
}

export async function onPaid ({ invoice, actIds }, { tx }) {
  let acts
  if (invoice) {
    await tx.itemAct.updateMany({
      where: { invoiceId: invoice.id },
      data: {
        invoiceActionState: 'PAID'
      }
    })
    acts = await tx.itemAct.findMany({ where: { invoiceId: invoice.id }, include: { item: true } })
    actIds = acts.map(act => act.id)
  } else if (actIds) {
    acts = await tx.itemAct.findMany({ where: { id: { in: actIds } }, include: { item: true } })
  } else {
    throw new Error('No invoice or actIds')
  }

  const msats = acts.reduce((a, b) => a + BigInt(b.msats), BigInt(0))
  const sats = msatsToSats(msats)
  const itemAct = acts.find(act => act.act === 'TIP')

  if (invoice?.invoiceForward) {
    // only the op got sats and we need to add it to their stackedMsats
    // because the sats were p2p
    await tx.user.update({
      where: { id: itemAct.item.userId },
      data: { stackedMsats: { increment: itemAct.msats } }
    })
  } else {
    // splits only use mcredits
    await tx.$executeRaw`
      WITH forwardees AS (
        SELECT "userId", ((${itemAct.msats}::BIGINT * pct) / 100)::BIGINT AS mcredits
        FROM "ItemForward"
        WHERE "itemId" = ${itemAct.itemId}::INTEGER
      ), total_forwarded AS (
        SELECT COALESCE(SUM(mcredits), 0) as mcredits
        FROM forwardees
      ), recipients AS (
        SELECT "userId", mcredits FROM forwardees
        UNION
        SELECT ${itemAct.item.userId}::INTEGER as "userId",
          ${itemAct.msats}::BIGINT - (SELECT mcredits FROM total_forwarded)::BIGINT as mcredits
        ORDER BY "userId" ASC -- order to prevent deadlocks
      )
      UPDATE users
      SET
        mcredits = users.mcredits + recipients.mcredits,
        "stackedMsats" = users."stackedMsats" + recipients.mcredits,
        "stackedMcredits" = users."stackedMcredits" + recipients.mcredits
      FROM recipients
      WHERE users.id = recipients."userId"`
  }

  // perform denomormalized aggregates: weighted votes, upvotes, msats, lastZapAt
  // NOTE: for the rows that might be updated by a concurrent zap, we use UPDATE for implicit locking
  await tx.$queryRaw`
    WITH territory AS (
      SELECT COALESCE(r."subName", i."subName", 'meta')::CITEXT as "subName"
      FROM "Item" i
      LEFT JOIN "Item" r ON r.id = i."rootId"
      WHERE i.id = ${itemAct.itemId}::INTEGER
    ), zapper AS (
      SELECT
        COALESCE(${itemAct.item.parentId
          ? Prisma.sql`"zapCommentTrust"`
          : Prisma.sql`"zapPostTrust"`}, 0) as "zapTrust",
        COALESCE(${itemAct.item.parentId
          ? Prisma.sql`"subZapCommentTrust"`
          : Prisma.sql`"subZapPostTrust"`}, 0) as "subZapTrust"
      FROM territory
      LEFT JOIN "UserSubTrust" ust ON ust."subName" = territory."subName"
        AND ust."userId" = ${itemAct.userId}::INTEGER
    ), zap AS (
      INSERT INTO "ItemUserAgg" ("userId", "itemId", "zapSats")
      VALUES (${itemAct.userId}::INTEGER, ${itemAct.itemId}::INTEGER, ${sats}::INTEGER)
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
        mcredits = "Item".mcredits + ${invoice?.invoiceForward ? 0n : msats}::BIGINT,
        "lastZapAt" = now()
      FROM zap, zapper
      WHERE "Item".id = ${itemAct.itemId}::INTEGER
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
      "commentMcredits" = "Item"."commentMcredits" + ${invoice?.invoiceForward ? 0n : msats}::BIGINT
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
      WHERE "ItemUserAgg"."userId" = ${itemAct.userId}::INTEGER
      AND "ItemUserAgg"."itemId" = ${itemAct.itemId}::INTEGER
      AND root."userId" = ${itemAct.userId}::INTEGER
      AND root.bounty IS NOT NULL
    )
    UPDATE "Item"
    SET "bountyPaidTo" = array_remove(array_append(array_remove("bountyPaidTo", bounty.target), bounty.target), NULL)
    FROM bounty
    WHERE "Item".id = bounty.id AND bounty.paid`
}

export async function nonCriticalSideEffects ({ invoice, actIds }, { models }) {
  const itemAct = await models.itemAct.findFirst({
    where: invoice ? { invoiceId: invoice.id } : { id: { in: actIds } },
    include: { item: true }
  })
  // avoid duplicate notifications with the same zap amount
  // by checking if there are any other pending acts on the item
  const pendingActs = await models.itemAct.count({
    where: {
      itemId: itemAct.itemId,
      createdAt: {
        gt: itemAct.createdAt
      }
    }
  })
  if (pendingActs === 0) notifyZapped({ models, item: itemAct.item }).catch(console.error)
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ id: itemId, sats }, { actionId, cost }) {
  return `SN: zap ${sats ?? msatsToSats(cost)} sats to #${itemId ?? actionId}`
}
