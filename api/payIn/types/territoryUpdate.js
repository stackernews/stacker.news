import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { proratedBillingCost } from '@/lib/territory'
import { datePivot } from '@/lib/time'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

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

  return satsToMsats(cost)
}

export async function perform ({ oldName, invoiceId, ...data }, { me, cost, tx }) {
  const oldSub = await tx.sub.findUnique({
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
      // optimistic concurrency control
      // make sure none of the relevant fields have changed since we fetched the sub
      ...oldSub,
      postTypes: {
        equals: oldSub.postTypes
      },
      name: oldName,
      userId: me.id
    }
  })
}

export async function describe ({ name }, context) {
  return `SN: update territory billing ${name}`
}
