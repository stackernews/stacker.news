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

export async function getInitial (models, { oldName, billingType }, { me }) {
  const oldSub = await models.sub.findUnique({
    where: {
      name: oldName
    }
  })

  const mcost = satsToMsats(proratedBillingCost(oldSub, billingType) ?? 0)

  return {
    payInType: 'TERRITORY_UPDATE',
    userId: me?.id,
    mcost,
    payOutCustodialTokens: [{ payOutType: 'SYSTEM_REVENUE', userId: null, mtokens: mcost, custodialTokenType: 'SATS' }]
  }
}

export async function onPaid (tx, payInId, { me }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { pessimisticEnv: true } })
  const { args: { oldName, invoiceId, ...data } } = payIn.pessimisticEnv
  const oldSub = await tx.sub.findUnique({
    where: {
      name: oldName
    }
  })

  data.billingCost = TERRITORY_PERIOD_COST(data.billingType)
  data.subPayIn = {
    create: {
      payInId
    }
  }

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

export async function describe (models, payInId) {
  const { sub } = await models.subPayIn.findUnique({ where: { payInId }, include: { sub: true } })
  return `SN: update territory billing ${sub.name}`
}
