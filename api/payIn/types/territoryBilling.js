import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST, USER_ID } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { nextBilling } from '@/lib/territory'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { name }, { me }) {
  const sub = await models.sub.findUnique({
    where: {
      name
    }
  })

  const mcost = satsToMsats(TERRITORY_PERIOD_COST(sub.billingType))

  return {
    payInType: 'TERRITORY_BILLING',
    userId: me?.id,
    mcost,
    payOutCustodialTokens: [
      { payOutType: 'SYSTEM_REVENUE', userId: USER_ID.sn, mtokens: mcost, custodialTokenType: 'SATS' }
    ]
  }
}

export async function onBegin (tx, payInId, { name }) {
  const sub = await tx.sub.findUnique({
    where: {
      name
    }
  })

  if (sub.billingType === 'ONCE') {
    throw new Error('Cannot bill a ONCE territory')
  }

  let billedLastAt = sub.billPaidUntil
  let billingCost = sub.billingCost

  // if the sub is archived, they are paying to reactivate it
  if (sub.status === 'STOPPED') {
    // get non-grandfathered cost and reset their billing to start now
    billedLastAt = new Date()
    billingCost = TERRITORY_PERIOD_COST(sub.billingType)
  }

  const billPaidUntil = nextBilling(billedLastAt, sub.billingType)

  return await tx.sub.update({
    // optimistic concurrency control
    // make sure the sub hasn't changed since we fetched it
    where: {
      ...sub,
      postTypes: {
        equals: sub.postTypes
      }
    },
    data: {
      billedLastAt,
      billPaidUntil,
      billingCost,
      status: 'ACTIVE',
      subPayIn: { create: [{ payInId }] }
    }
  })
}

export async function describe (models, payInId) {
  const { sub } = await models.subPayIn.findUnique({ where: { payInId }, include: { sub: true } })
  return `SN: billing for territory ${sub.name}`
}
