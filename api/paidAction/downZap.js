export const anonable = false
export const supportsPessimism = false
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function perform ({ invoiceId, sats, id: itemId }, { me, cost, models, tx }) {
  itemId = parseInt(itemId)

  let invoiceData = {}
  if (invoiceId) {
    invoiceData = { invoiceId, invoiceActionState: 'PENDING' }
  }

  const itemAct = await tx.itemAct.create({
    data: { msats: cost, itemId, userId: me.id, act: 'DONT_LIKE_THIS', ...invoiceData }
  })

  const [{ path }] = await tx.$queryRaw`SELECT ltree2text(path) as path FROM "Item" WHERE id = ${itemId}`
  return { id: itemId, sats, act: 'DONT_LIKE_THIS', path, actId: itemAct.id }
}

export async function onPaid ({ invoice, actId }, { models, tx }) {
  let itemAct
  if (invoice) {
    itemAct = await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  } else if (actId) {
    itemAct = await tx.itemAct.findUnique({ where: { id: actId } })
  } else {
    throw new Error('No invoice or actId')
  }

  await tx.$executeRaw`SELECT weighted_downvotes_after_act(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${itemAct.msats / BigInt(1000)}::INTEGER)`
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ itemId, sats }, context) {
  return `SN: downzap of ${sats} sats to #${itemId}`
}
