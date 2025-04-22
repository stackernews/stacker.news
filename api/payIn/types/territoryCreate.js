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

export async function getCost (models, { billingType }, { me }) {
  return satsToMsats(TERRITORY_PERIOD_COST(billingType))
}

export async function getPayOuts (models, payIn, { name }) {
  return {
    payOutCustodialTokens: [
      { payOutType: 'SYSTEM_REVENUE', userId: null, mtokens: payIn.mcost, custodialTokenType: 'SATS' }
    ]
  }
}

export async function onPaid (tx, payInId, { me }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { pessimisticEnv: true } })
  const { billingType, ...data } = payIn.pessimisticEnv.args
  const billingCost = TERRITORY_PERIOD_COST(billingType)
  const billedLastAt = new Date()
  const billPaidUntil = nextBilling(billedLastAt, billingType)

  const sub = await tx.sub.create({
    data: {
      ...data,
      billedLastAt,
      billPaidUntil,
      billingCost,
      rankingType: 'WOT',
      userId: me.id,
      SubAct: {
        create: {
          payInId
        }
      },
      SubSubscription: {
        create: {
          userId: me.id
        }
      }
    }
  })

  await tx.userSubTrust.createMany({
    data: initialTrust({ name: sub.name, userId: sub.userId })
  })

  return sub
}

export async function describe (models, payInId, { me }) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { pessimisticEnv: true } })
  const { args: { name } } = payIn.pessimisticEnv
  return `SN: create territory ${name}`
}
