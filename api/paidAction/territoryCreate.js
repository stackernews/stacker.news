import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { nextBilling } from '@/lib/territory'
import { initialTrust } from './lib/territory'
import { throwOnExpiredUploads, uploadFees } from '@/api/resolvers/upload'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getCost ({ billingType, uploadIds }, { models, me }) {
  const { totalFees } = await uploadFees(uploadIds, { models, me })
  return satsToMsats(TERRITORY_PERIOD_COST(billingType) + totalFees)
}

export async function perform ({ invoiceId, ...data }, { me, cost, tx }) {
  const { billingType } = data
  const billingCost = TERRITORY_PERIOD_COST(billingType)
  const billedLastAt = new Date()
  const billPaidUntil = nextBilling(billedLastAt, billingType)

  await throwOnExpiredUploads(data.uploadIds, { tx })
  if (data.uploadIds.length > 0) {
    await tx.upload.updateMany({
      where: {
        id: { in: data.uploadIds }
      },
      data: {
        paid: true
      }
    })
  }
  delete data.uploadIds

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

  await tx.userSubTrust.createMany({
    data: initialTrust({ name: sub.name, userId: sub.userId })
  })

  return sub
}

export async function describe ({ name }) {
  return `SN: create territory ${name}`
}
