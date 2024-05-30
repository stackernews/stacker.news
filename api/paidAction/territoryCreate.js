import { TERRITORY_PERIOD_COST } from '@/lib/constants'
import { nextBilling } from '@/lib/territory'
export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ billingType }) {
  return TERRITORY_PERIOD_COST(billingType) * BigInt(1000)
}

export async function perform (data, { me, cost, tx }) {
  const { billingType } = data
  const billingCost = TERRITORY_PERIOD_COST(billingType)
  const billedLastAt = new Date()
  const billPaidUntil = nextBilling(billedLastAt, billingType)

  const result = await tx.sub.create({
    data: {
      ...data,
      billedLastAt,
      billPaidUntil,
      billingCost,
      rankingType: 'WOT',
      userId: me.id
    }
  })

  await tx.subAct.create({
    data: {
      userId: me.id,
      subName: data.name,
      msats: cost,
      type: 'BILLING'
    }
  })

  await tx.subSubscription.create({
    data: {
      userId: me.id,
      subName: data.name
    }
  })

  return result
}

export async function describe ({ name }) {
  return `SN: create territory ${name}`
}
