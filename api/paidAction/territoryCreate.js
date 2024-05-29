import { TERRITORY_PERIOD_COST } from '@/lib/constants'
import { nextBilling } from '@/lib/territory'
export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ billingType }) {
  return TERRITORY_PERIOD_COST(billingType) * BigInt(1000)
}

export async function doStatements (data, { me, cost, models }) {
  const { billingType } = data
  const billingCost = TERRITORY_PERIOD_COST(billingType)
  const billedLastAt = new Date()
  const billPaidUntil = nextBilling(billedLastAt, billingType)

  return [
    // create 'em
    models.sub.create({
      data: {
        ...data,
        billedLastAt,
        billPaidUntil,
        billingCost,
        rankingType: 'WOT',
        userId: me.id
      }
    }),
    // record 'em
    models.subAct.create({
      data: {
        userId: me.id,
        subName: data.name,
        msats: cost,
        type: 'BILLING'
      }
    }),
    // notify 'em (in the future)
    models.subSubscription.create({
      data: {
        userId: me.id,
        subName: data.name
      }
    })
  ]
}

// because we are only pessimistic, we don't need to do anything after the invoice is paid
export async function onPaidStatements ({ invoice }, { models }) {
  return []
}

export async function resultsToResponse (results, args, context) {
  return results[0]
}

export async function describe ({ name }, context) {
  return `SN: create territory ${name}`
}
