import { HALLOWEEN_IMMUNITY_HOURS, PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { msatsToSats, satsToMsats } from '@/lib/format'
import { datePivot } from '@/lib/time'
import { notifyZapped, notifyInfected } from '@/lib/webPush'
import { getInvoiceableWallets } from '@/wallets/server'
import { Prisma } from '@prisma/client'

export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P,
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getCost ({ sats }) {
  return satsToMsats(sats)
}

export async function getInvoiceablePeer ({ id, sats, hasSendWallet }, { models, me, cost }) {
  // if the zap is dust, or if me doesn't have a send wallet but has enough sats/credits to pay for it
  // then we don't invoice the peer
  if (sats < me?.sendCreditsBelowSats ||
    (me && !hasSendWallet && (me.mcredits >= cost || me.msats >= cost))) {
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

  const protocols = await getInvoiceableWallets(item.userId, { models })

  // request peer invoice if they have an attached wallet and have not forwarded the item
  // and the receiver doesn't want to receive credits
  if (protocols.length > 0 &&
    item.itemForwards.length === 0 &&
    sats >= item.user.receiveCreditsBelowSats) {
    return item.userId
  }

  return null
}

export async function getSybilFeePercent () {
  return 30n
}

export async function perform ({ invoiceId, sats, id: itemId, ...args }, { me, cost, sybilFeePercent, tx }) {
  const feeMsats = cost * sybilFeePercent / 100n
  const zapMsats = cost - feeMsats
  itemId = parseInt(itemId)

  let invoiceData = {}
  if (invoiceId) {
    invoiceData = { invoiceId, invoiceActionState: 'PENDING' }
    // store a reference to the item in the invoice
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { actionId: itemId }
    })
  }

  const acts = await tx.itemAct.createManyAndReturn({
    data: [
      { msats: feeMsats, itemId, userId: me?.id ?? USER_ID.anon, act: 'FEE', ...invoiceData },
      { msats: zapMsats, itemId, userId: me?.id ?? USER_ID.anon, act: 'TIP', ...invoiceData }
    ]
  })

  const [{ userId, path }] = await tx.$queryRaw`
    SELECT "userId", ltree2text(path) as path FROM "Item" WHERE id = ${itemId}::INTEGER`

  const immune = await isImmune(userId, { tx })

  return { id: itemId, sats, act: 'TIP', path, immune, actIds: acts.map(act => act.id) }
}

export async function retry ({ invoiceId, newInvoiceId }, { tx, cost }) {
  await tx.itemAct.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  const [{ id, path }] = await tx.$queryRaw`
    SELECT "Item".id, ltree2text(path) as path
    FROM "Item"
    JOIN "ItemAct" ON "Item".id = "ItemAct"."itemId"
    WHERE "ItemAct"."invoiceId" = ${newInvoiceId}::INTEGER`
  return { id, sats: msatsToSats(cost), act: 'TIP', path }
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

  await maybeInfectUser(itemAct, { tx })
}

async function isImmune (userId, { tx }) {
  const item = await tx.item.findFirst({
    where: {
      userId,
      createdAt: { gt: datePivot(new Date(), { hours: -HALLOWEEN_IMMUNITY_HOURS }) }
    }
  })
  return !!item
}

async function maybeInfectUser (itemAct, { tx }) {
  // We added the 'infected' column to the users table so the query for users can continue
  // to only fetch columns from the users table. We only use it for display purposes.
  // The infection table is used to check if a user is infected and store additional information
  // (who infected who when why).

  const { id, userId: fromId, item: { userId: toId } } = itemAct
  const infection = await tx.infection.findFirst({ where: { infecteeId: fromId } })
  if (!infection) {
    // zapper not infected, so can't infect other user
    return
  }

  if (await isImmune(toId, { tx })) {
    // user is immune because they created an item not too long ago
    return
  }

  const count = await tx.$executeRaw`
    INSERT INTO "Infection" ("itemActId", "infecteeId", "infectorId")
    VALUES (${id}::INTEGER, ${toId}::INTEGER, ${fromId}::INTEGER)
    ON CONFLICT ("infecteeId") DO NOTHING`
  await tx.user.update({ where: { id: toId }, data: { infected: true } })

  if (count > 0) {
    notifyInfected(toId).catch(console.error)
  }
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
