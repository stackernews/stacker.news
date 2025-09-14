import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST, USER_ID } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { nextBilling } from '@/lib/territory'
import { initialTrust } from '../lib/territory'
import * as MEDIA_UPLOAD from './mediaUpload'
import { getBeneficiariesMcost } from '../lib/beneficiaries'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { billingType, uploadIds }, { me }) {
  const beneficiaries = []
  if (uploadIds.length > 0) {
    beneficiaries.push(await MEDIA_UPLOAD.getInitial(models, { uploadIds }, { me }))
  }

  const mcost = satsToMsats(TERRITORY_PERIOD_COST(billingType))
  return {
    payInType: 'TERRITORY_CREATE',
    userId: me?.id,
    mcost: mcost + getBeneficiariesMcost(beneficiaries),
    payOutCustodialTokens: [
      { payOutType: 'SYSTEM_REVENUE', userId: USER_ID.sn, mtokens: mcost, custodialTokenType: 'SATS' }
    ],
    beneficiaries
  }
}

export async function onBegin (tx, payInId, { billingType, ...data }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId } })
  const billingCost = TERRITORY_PERIOD_COST(billingType)
  const billedLastAt = new Date()
  const billPaidUntil = nextBilling(billedLastAt, billingType)

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
