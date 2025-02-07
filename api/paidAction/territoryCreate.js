import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { nextBilling } from '@/lib/territory'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getCost ({ billingType }) {
  return satsToMsats(TERRITORY_PERIOD_COST(billingType))
}

export async function perform ({ invoiceId, ...data }, { me, cost, tx }) {
  const { billingType } = data
  const billingCost = TERRITORY_PERIOD_COST(billingType)
  const billedLastAt = new Date()
  const billPaidUntil = nextBilling(billedLastAt, billingType)

  return await tx.sub.create({
    data: {
      ...data,
      billedLastAt,
      billPaidUntil,
      billingCost,
      rankingType: 'WOT',
      userId: me.id,
      SubAct: {
        create: {
          msats: cost,
          type: 'BILLING',
          userId: me.id
        }
      },
      SubSubscription: {
        create: {
          userId: me.id
        }
      }
    }
  })
}

export async function describe ({ name }) {
  return `SN: create territory ${name}`
}
