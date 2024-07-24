import { USER_ID } from '@/lib/constants'
import { msatsToSats, satsToMsats } from '@/lib/format'
import { notifyZapped } from '@/lib/webPush'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return satsToMsats(sats)
}

export async function perform ({ invoiceId, sats, id: itemId, ...args }, { me, cost, tx }) {
  const feeMsats = cost / BigInt(10) // 10% fee
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

export async function onPaid ({ invoice, actIds }, { models, tx }) {
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

  // give user and all forwards the sats
  await tx.$executeRaw`
    WITH forwardees AS (
      SELECT "userId", ((${itemAct.msats}::BIGINT * pct) / 100)::BIGINT AS msats
      FROM "ItemForward"
      WHERE "itemId" = ${itemAct.itemId}::INTEGER
    ), total_forwarded AS (
      SELECT COALESCE(SUM(msats), 0) as msats
      FROM forwardees
    ), forward AS (
      UPDATE users
      SET
        msats = users.msats + forwardees.msats,
        "stackedMsats" = users."stackedMsats" + forwardees.msats
      FROM forwardees
      WHERE users.id = forwardees."userId"
    )
    UPDATE users
    SET
      msats = msats + ${itemAct.msats}::BIGINT - (SELECT msats FROM total_forwarded)::BIGINT,
      "stackedMsats" = "stackedMsats" + ${itemAct.msats}::BIGINT - (SELECT msats FROM total_forwarded)::BIGINT
    WHERE id = ${itemAct.item.userId}::INTEGER`

  // perform denomormalized aggregates: weighted votes, upvotes, msats, lastZapAt
  // NOTE: for the rows that might be updated by a concurrent zap, we use UPDATE for implicit locking
  const [item] = await tx.$queryRaw`
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
      SET "commentMsats" = "Item"."commentMsats" + ${msats}::BIGINT
      FROM zapped
      WHERE "Item".path @> zapped.path AND "Item".id <> zapped.id`

  notifyZapped({ models, item }).catch(console.error)
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ id: itemId, sats }, { actionId, cost }) {
  return `SN: zap ${sats ?? msatsToSats(cost)} sats to #${itemId ?? actionId}`
}
