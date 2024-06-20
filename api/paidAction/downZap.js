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

  // TODO: this probably has read-modify-write issues
  await tx.$executeRaw`SELECT weighted_downvotes_after_act(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${BigInt(itemAct.msats) / BigInt(1000)}::INTEGER)`
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ itemId, sats }, { cost, actionId }) {
  return `SN: downzap of ${sats ?? (cost / BigInt(1000))} sats to #${itemId ?? actionId}`
}
