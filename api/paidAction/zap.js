import { PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { msatsToSats, satsToMsats } from '@/lib/format'
import { notifyZapped } from '@/lib/webPush'
import { getInvoiceableWallets } from '@/wallets/server'

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

  const [{ path }] = await tx.$queryRaw`
    SELECT ltree2text(path) as path FROM "Item" WHERE id = ${itemId}::INTEGER`
  return { id: itemId, sats, act: 'TIP', path, actIds: acts.map(act => act.id) }
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
    WITH zapper AS (
      SELECT trust FROM users WHERE id = ${itemAct.userId}::INTEGER
    ), zap AS (
      INSERT INTO "ItemUserAgg" ("userId", "itemId", "zapSats")
      VALUES (${itemAct.userId}::INTEGER, ${itemAct.itemId}::INTEGER, ${sats}::INTEGER)
      ON CONFLICT ("itemId", "userId") DO UPDATE
      SET "zapSats" = "ItemUserAgg"."zapSats" + ${sats}::INTEGER, updated_at = now()
      RETURNING ("zapSats" = ${sats}::INTEGER)::INTEGER as first_vote,
        LOG("zapSats" / GREATEST("zapSats" - ${sats}::INTEGER, 1)::FLOAT) AS log_sats
    )
    UPDATE "Item"
    SET
      "weightedVotes" = "weightedVotes" + (zapper.trust * zap.log_sats),
      upvotes = upvotes + zap.first_vote,
      msats = "Item".msats + ${msats}::BIGINT,
      mcredits = "Item".mcredits + ${invoice?.invoiceForward ? 0n : msats}::BIGINT,
      "lastZapAt" = now()
    FROM zap, zapper
    WHERE "Item".id = ${itemAct.itemId}::INTEGER
    RETURNING "Item".*`

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

  // update commentMsats on ancestors
  await tx.$executeRaw`
      WITH zapped AS (
        SELECT * FROM "Item" WHERE id = ${itemAct.itemId}::INTEGER
      )
      UPDATE "Item"
      SET "commentMsats" = "Item"."commentMsats" + ${msats}::BIGINT,
        "commentMcredits" = "Item"."commentMcredits" + ${invoice?.invoiceForward ? 0n : msats}::BIGINT
      FROM zapped
      WHERE "Item".path @> zapped.path AND "Item".id <> zapped.id`
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
