export const anonable = false
export const supportsPessimism = false
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function perform ({ invoiceId, sats, itemId }, { me, cost, models, tx }) {
  await tx.itemAct.create({
    data: { msats: cost, itemId, userId: me.id, act: 'DONT_LIKE_THIS', invoiceId, invoiceActionState: 'PENDING' }
  })

  const item = await models.item.findUnique({ where: { id: itemId } })

  return { id: itemId, sats, act: 'DONT_LIKE_THIS', path: item.path }
}

export async function onPaid ({ invoice }, { models, tx }) {
  const itemAct = await tx.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } })
  await tx.$executeRaw(`SELECT weighted_downvotes_after_act(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${itemAct.msats / BigInt(1000)}::BIGINT)`)
}

export async function onFail ({ invoice }, { tx }) {
  await tx.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'FAILED' } })
}

export async function describe ({ itemId, sats }, context) {
  return `SN: downzap of ${sats} sats to #${itemId}`
}
