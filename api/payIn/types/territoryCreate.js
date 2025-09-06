import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST, USER_ID } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { nextBilling } from '@/lib/territory'
import { initialTrust } from '../lib/territory'
import { throwOnExpiredUploads } from '@/api/resolvers/upload'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { billingType }, { me }) {
  const mcost = satsToMsats(TERRITORY_PERIOD_COST(billingType))
  return {
    payInType: 'TERRITORY_CREATE',
    userId: me?.id,
    mcost,
    payOutCustodialTokens: [
      { payOutType: 'SYSTEM_REVENUE', userId: USER_ID.sn, mtokens: mcost, custodialTokenType: 'SATS' }
    ]
  }
}

export async function onBegin (tx, payInId, { billingType, ...data }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId } })
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
      billingType,
      rankingType: 'WOT',
      userId: payIn.userId,
      subPayIn: {
        create: [{ payInId }]
      },
      SubSubscription: {
        create: {
          userId: payIn.userId
        }
      }
    }
  })

  await tx.userSubTrust.createMany({
    data: initialTrust({ name: sub.name, userId: sub.userId })
  })

  return sub
}

export async function describe (models, payInId) {
  const { sub } = await models.subPayIn.findUnique({ where: { payInId }, include: { sub: true } })
  return `SN: create territory ${sub.name}`
}
