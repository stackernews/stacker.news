export const anonable = false
export const supportsPessimism = false
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function perform ({ invoiceId, sats, id: itemId }, { me, cost, tx }) {
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

  const itemAct = await tx.itemAct.create({
    data: { msats: cost, itemId, userId: me.id, act: 'DONT_LIKE_THIS', ...invoiceData }
  })

  const [{ path }] = await tx.$queryRaw`SELECT ltree2text(path) as path FROM "Item" WHERE id = ${itemId}`
  return { id: itemId, sats, act: 'DONT_LIKE_THIS', path, actId: itemAct.id }
}

export async function retry ({ invoiceId, newInvoiceId }, { tx, cost }) {
  await tx.itemAct.updateMany({ where: { invoiceId }, data: { invoiceId: newInvoiceId, invoiceActionState: 'PENDING' } })
  const [{ id, path }] = await tx.$queryRaw`
    SELECT "Item".id, ltree2text(path) as path
    FROM "Item"
    JOIN "ItemAct" ON "Item".id = "ItemAct"."itemId"
    WHERE "ItemAct"."invoiceId" = ${newInvoiceId}`
  return { id, sats: Number(BigInt(cost) / BigInt(1000)), act: 'DONT_LIKE_THIS', path }
}

export async function onPaid ({ invoice, actId }, { tx }) {
  let itemAct
  if (invoice) {
    await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
    itemAct = await tx.itemAct.findFirst({ where: { invoiceId: invoice.id } })
  } else if (actId) {
    itemAct = await tx.itemAct.findUnique({ where: { id: actId } })
  } else {
    throw new Error('No invoice or actId')
  }

  const msats = BigInt(itemAct.msats)
  const sats = msats / BigInt(1000)

  // XXX this is vulnerable to serialization anomalies in the case of multiple zaps from the same user
  // see ./zap.js for more info
  await tx.$executeRaw`
    WITH zapper AS (
      SELECT * FROM users WHERE id = ${itemAct.userId}
    ), zapped AS (
      SELECT COALESCE(SUM("ItemAct".msats) / 1000, 0)  as sats
      FROM "ItemAct"
      WHERE "ItemAct"."userId" = ${itemAct.userId}
      AND "ItemAct"."itemId" = ${itemAct.itemId}
      AND "ItemAct".id <> ${itemAct.id}
      AND act IN ('DONT_LIKE_THIS')
      AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
    ), zap AS (
      SELECT (zapper.trust *
        CASE WHEN zapped.sats = 0
          THEN LOG(${sats})
          ELSE LOG((zapped.sats + ${sats}) / zapped.sats)
        END) AS weighted_down_vote
      FROM zapper, zapped
    )
    UPDATE "Item"
    SET "weightedDownVotes" = "weightedDownVotes" + zap.weighted_down_vote
    FROM zap
    WHERE id = ${itemAct.itemId}`
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ itemId, sats }, { cost, actionId }) {
  return `SN: downzap of ${sats ?? (cost / BigInt(1000))} sats to #${itemId ?? actionId}`
}
