import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { nextBilling } from '@/lib/territory'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getCost ({ billingType }) {
  return satsToMsats(TERRITORY_PERIOD_COST(billingType))
}

export async function perform ({ name, invoiceId, ...data }, { me, cost, tx }) {
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
    // optimistic concurrency control
    // make sure none of the relevant fields have changed since we fetched the sub
    where: {
      ...sub,
      postTypes: {
        equals: sub.postTypes
      }
    }
  })
}

export async function describe ({ name }, context) {
  return `SN: unarchive territory ${name}`
}
