import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { nextBilling } from '@/lib/territory'
import { initialTrust } from '../lib/territory'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
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
    await tx.subSubscription.delete({ where: { userId_subName: { userId: sub.userId, subName: name } } })
  }

  await tx.subAct.create({
    data: {
      userId: me.id,
      subName: name,
      msats: cost,
      type: 'BILLING'
    }
  })

  await tx.subSubscription.upsert({
    where: {
      userId_subName: {
        userId: me.id,
        subName: name
      }
    },
    update: {
      userId: me.id,
      subName: name
    },
    create: {
      userId: me.id,
      subName: name
    }
  })

  const updatedSub = await tx.sub.update({
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

  await tx.userSubTrust.createMany({
    data: initialTrust({ name: updatedSub.name, userId: updatedSub.userId })
  })

  return updatedSub
}

export async function describe ({ name }, context) {
  return `SN: unarchive territory ${name}`
}
