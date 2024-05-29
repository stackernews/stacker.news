export const anonable = false
export const supportsPessimism = false
export const supportsOptimism = true

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function doStatements ({ invoiceId, sats, itemId, ...args }, { me, cost, models }) {
  return [models.itemAct.createMany({
    data: [
      { msats: cost, itemId, userId: me.id, act: 'DONT_LIKE_THIS', invoiceId, invoiceActionState: 'PENDING' }
    ]
  })]
}

export async function onPaidStatements ({ invoice }, { models }) {
  const [itemAct] = await models.itemAct.findFirst({
    where: {
      invoiceId: invoice.id,
      act: 'DONT_LIKE_THIS',
      invoiceActionState: 'PENDING'
    }
  })

  return [
    models.itemAct.update({ where: { invoiceId: invoice.id }, data: { invoiceActionState: 'PAID' } }),
    models.$executeRaw(`SELECT weighted_downvotes_after_act(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${itemAct.msats / BigInt(1000)}::BIGINT)`)
  ]
}

export async function resultsToResponse (results, { id, sats, act, path }, { models }) {
  const item = await models.item.findUnique({ where: { id } })
  return {
    id,
    sats,
    act,
    path: item.path
  }
}

export async function describe ({ itemId, sats }, context) {
  return `SN: downzap of ${sats} sats to #${itemId}`
}
