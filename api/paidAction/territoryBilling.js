import { TERRITORY_PERIOD_COST } from '@/lib/constants'
import { nextBilling } from '@/lib/territory'

export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ name }, { models }) {
  const sub = await models.sub.findUnique({
    where: {
      name
    }
  })

  return TERRITORY_PERIOD_COST(sub.billingType) * BigInt(1000)
}

export async function perform ({ name }, { cost, tx }) {
  const sub = await tx.sub.findUnique({
    where: {
      name
    }
  })

  let billedLastAt = sub.billPaidUntil
  let billingCost = sub.billingCost

  // if the sub is archived, they are paying to reactivate it
  if (sub.status === 'STOPPED') {
    // get non-grandfathered cost and reset their billing to start now
    billedLastAt = new Date()
    billingCost = TERRITORY_PERIOD_COST(sub.billingType)
  }

  const billPaidUntil = nextBilling(billedLastAt, sub.billingType)

  await tx.subAct.create({
    data: {
      userId: sub.userId,
      subName: sub.name,
      msats: cost,
      type: 'BILLING'
    }
  })

  return await tx.sub.update({
    where: {
      name: sub.name
    },
    data: {
      billedLastAt,
      billPaidUntil,
      billingCost,
      status: 'ACTIVE'
    }
  })
}

export async function describe ({ name }) {
  return `SN: billing for territory ${name}`
}
