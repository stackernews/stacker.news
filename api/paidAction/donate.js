export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function doStatements ({ sats }, { me, cost, models }) {
  return [models.donate.create({
    data: {
      sats,
      userId: me.id
    }
  })]
}

// because we are only pessimistic, we don't need to do anything after the invoice is paid
export async function onPaidStatements () {
  return []
}

export async function resultsToResponse (results, { sats }, context) {
  return sats
}

export async function describe (args, context) {
  return 'SN: donate to rewards pool'
}
