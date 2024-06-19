import { TERRITORY_PERIOD_COST } from '@/lib/constants'
import { nextBilling } from '@/lib/territory'

export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ billingType }) {
  return BigInt(TERRITORY_PERIOD_COST(billingType)) * BigInt(1000)
}

export async function perform ({ name, ...data }, { me, cost, tx }) {
  const sub = await tx.sub.findUnique({
    where: {
      name
    }
  })

  data.billingCost = TERRITORY_PERIOD_COST(data.billingType)

  // we never want to bill them again if they are changing to ONCE
  if (data.billingType === 'ONCE') {
    data.billPaidUntil = null
    data.billingAutoRenew = false
  }

  data.billedLastAt = new Date()
  data.billPaidUntil = nextBilling(data.billedLastAt, data.billingType)
  data.status = 'ACTIVE'
  data.userId = me.id

  if (sub.userId !== me.id) {
    await tx.territoryTransfer.create({ data: { subName: name, oldUserId: sub.userId, newUserId: me.id } })
  }

  await tx.subAct.create({
    data: {
      userId: me.id,
      subName: name,
      msats: cost,
      type: 'BILLING'
    }
  })

  return await tx.sub.update({
    data,
    where: {
      name
    }
  })
}

export async function describe ({ name }, context) {
  return `SN: unarchive territory ${name}`
}
