export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost () {
  // TODO
  return null
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
    // TODO: assumes sats are in msats
    models.$executeRaw(`SELECT weighted_downvotes_after_act(${itemAct.itemId}::INTEGER, ${itemAct.userId}::INTEGER, ${itemAct.msats}::BIGINT)`)
  ]
}

export async function resultsToResponse (results, args, context) {
  // TODO
  return null
}

export async function describe ({ name }, context) {
  return `SN: update territory ${name}`
}
