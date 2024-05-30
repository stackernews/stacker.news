import { TERRITORY_PERIOD_COST } from '@/lib/constants'
import { proratedBillingCost } from '@/lib/territory'
import { datePivot } from '@/lib/time'

export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ oldName, billingType }, { models }) {
  const oldSub = await models.sub.findUnique({
    where: {
      name: oldName
    }
  })

  const cost = proratedBillingCost(oldSub, billingType)
  if (!cost) {
    return 0n
  }

  return BigInt(cost) * BigInt(1000)
}

export async function perform ({ invoiceId, oldName, ...data }, { me, cost, models, tx }) {
  const oldSub = await models.sub.findUnique({
    where: {
      name: oldName
    }
  })

  data.billingCost = TERRITORY_PERIOD_COST(data.billingType)

  // we never want to bill them again if they are changing to ONCE
  if (data.billingType === 'ONCE') {
    data.billPaidUntil = null
    data.billingAutoRenew = false
  }

  // if they are changing to YEARLY, bill them in a year
  // if they are changing to MONTHLY from YEARLY, do nothing
  if (oldSub.billingType === 'MONTHLY' && data.billingType === 'YEARLY') {
    data.billPaidUntil = datePivot(new Date(oldSub.billedLastAt), { years: 1 })
  }

  // if this billing change makes their bill paid up, set them to active
  if (data.billPaidUntil === null || data.billPaidUntil >= new Date()) {
    data.status = 'ACTIVE'
  }

  if (cost > 0n) {
    await tx.subAct.create({
      data: {
        userId: me.id,
        subName: oldName,
        msats: cost,
        type: 'BILLING'
      }
    })
  }

  return await tx.sub.update({
    data,
    where: {
      name: oldName,
      userId: me.id
    }
  })
}

export async function describe ({ name }, context) {
  return `SN: update territory billing ${name}`
}
