export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function doStatements ({ invoiceId, sats }, { me, cost, models }) {
  return [models.donate.create({
    data: {
      sats,
      userId: me.id,
      invoiceId,
      invoiceActionState: 'PENDING'
    }
  })]
}

export async function onPaidStatements ({ invoice }, { models }) {
  return [
    models.donate.update({
      where: { invoiceId: invoice.id },
      data: { invoiceActionState: 'PAID' }
    })
  ]
}

export async function resultsToResponse (results, args, context) {
  // TODO
  return null
}

export async function describe (args, context) {
  return 'SN: donate to rewards pool'
}
