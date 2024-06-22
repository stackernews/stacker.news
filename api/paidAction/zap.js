import { USER_ID } from '@/lib/constants'
import { notifyZapped } from '@/lib/webPush'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function perform ({ invoiceId, sats, id: itemId, ...args }, { me, cost, tx }) {
  const feeMsats = cost / BigInt(100)
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
      { msats: feeMsats, itemId, userId: me?.id || USER_ID.anon, act: 'FEE', ...invoiceData },
      { msats: zapMsats, itemId, userId: me?.id || USER_ID.anon, act: 'TIP', ...invoiceData }
    ]
  })

  const [{ path }] = await tx.$queryRaw`SELECT ltree2text(path) as path FROM "Item" WHERE id = ${itemId}`
  return { id: itemId, sats, act: 'TIP', path, actIds: acts.map(act => act.id) }
}

export async function retry ({ invoiceId, newInvoiceId }, { tx, cost }) {
  await tx.itemAct.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  const [{ id, path }] = await tx.$queryRaw`
    SELECT "Item".id, ltree2text(path) as path
    FROM "Item"
    JOIN "ItemAct" ON "Item".id = "ItemAct"."itemId"
    WHERE "ItemAct"."invoiceId" = ${newInvoiceId}`
  return { id, sats: Number(BigInt(cost) / BigInt(1000)), act: 'TIP', path }
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
  const sats = msats / BigInt(1000)
  const itemAct = acts.find(act => act.act === 'TIP')

  // give user and all forwards the sats
  await tx.$executeRaw`
    WITH forwardees AS (
      SELECT "userId", ${itemAct.msats} * pct / 100 AS msats
      FROM "ItemForward"
      WHERE "itemId" = ${itemAct.itemId}
    ), total_forwarded AS (
      SELECT COALESCE(SUM(msats), 0) as msats
      FROM forwardees
    ), forward AS (
      UPDATE users
      SET msats = users.msats + forwardees.msats
      FROM forwardees
      WHERE users.id = forwardees."userId"
    )
    UPDATE users
    SET msats = msats + ${itemAct.msats} - (SELECT msats FROM total_forwarded)
    WHERE id = ${itemAct.item.userId}`

  // perform denomormalized aggregates: weighted votes, upvotes, msats, lastZapAt, bountyPaidTo
  // XXX this is vulnerable to serialization anomalies in the case of multiple zaps from the same user
  // on the same item at the exact same time
  // basically, in read committed, the select subqueries will see a different snapshot than update if
  // the update conflicts with another update and new rows are inserted while the update is blocked
  // e.g. it's possible that our aggregates in the zapped CTE will be stale
  // ... other than changing the isolation level, we could:
  // 1. store the aggregate zap from a user on an item in a separate table that can be locked `FOR UPDATE`
  // 2. store the aggregate zap from a user in a jsonb column on the item
  // see: https://stackoverflow.com/questions/61781595/postgres-read-commited-doesnt-re-read-updated-row?noredirect=1#comment109279507_61781595
  // or: https://www.cybertec-postgresql.com/en/transaction-anomalies-with-select-for-update/
  await tx.$executeRaw`
    WITH zapper AS (
      SELECT * FROM users WHERE id = ${itemAct.userId}
    ), zapped AS (
      SELECT COALESCE(SUM("ItemAct".msats) / 1000, 0)  as sats
      FROM "ItemAct"
      WHERE "ItemAct"."userId" = ${itemAct.userId}
      AND "ItemAct"."itemId" = ${itemAct.itemId}
      AND NOT "ItemAct".id = ANY (${actIds})
      AND act IN ('TIP', 'FEE')
      AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
    ),  zap AS (
      SELECT (zapper.trust *
        CASE WHEN zapped.sats = 0
          THEN LOG(${sats})
          ELSE LOG((zapped.sats + ${sats}) / zapped.sats)
        END) AS weighted_vote,
        CASE WHEN zapped.sats = 0 THEN 1 ELSE 0 END AS first_vote
      FROM zapper, zapped
    )
    UPDATE "Item"
    SET
      "weightedVotes" = "weightedVotes" + zap.weighted_vote,
      upvotes = upvotes + zap.first_vote,
      msats = msats + ${msats},
      "lastZapAt" = now()
    FROM zap
    WHERE id = ${itemAct.itemId}`

  // pay bounty ... also vulnerable to serialization anomalies
  await tx.$executeRaw`
    WITH bounty AS (
      SELECT root.id, COALESCE(SUM("ItemAct".msats) / 1000, 0) >= root.bounty AS paid, "ItemAct"."itemId" AS target
      FROM "ItemAct"
      JOIN "Item" ON "Item".id = "ItemAct"."itemId"
      LEFT JOIN "Item" root ON root.id = "Item"."rootId"
      WHERE "ItemAct"."userId" = ${itemAct.userId}
      AND "ItemAct"."itemId" = ${itemAct.itemId}
      AND root."userId" = ${itemAct.userId}
      AND root.bounty IS NOT NULL
      AND act IN ('TIP', 'FEE')
      AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
      GROUP BY root.id, "ItemAct"."itemId"
    )
    UPDATE "Item"
    SET "bountyPaidTo" = array_remove(array_append(array_remove("bountyPaidTo", bounty.target), bounty.target), NULL)
    FROM bounty
    WHERE "Item".id = bounty.id
    AND bounty.paid`

  // update commentMsats on ancestors
  await tx.$executeRaw`
      WITH zapped AS (
        SELECT * FROM "Item" WHERE id = ${itemAct.itemId}
      )
      UPDATE "Item"
      SET "commentMsats" = "Item"."commentMsats" + ${msats}
      FROM zapped
      WHERE "Item".path @> zapped.path AND "Item".id <> zapped.id`

  // TODO: referrals
  notifyZapped({ models, id: itemAct.itemId }).catch(console.error)
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ id: itemId, sats }, { actionId, cost }) {
  return `SN: zap ${sats ?? (cost / BigInt(1000))} sats to #${itemId ?? actionId}`
}
