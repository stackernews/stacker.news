import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST, USER_ID } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { proratedBillingCost } from '@/lib/territory'
import { datePivot } from '@/lib/time'
import * as MEDIA_UPLOAD from './mediaUpload'
import { getBeneficiariesMcost } from '../lib/beneficiaries'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { oldName, billingType, uploadIds }, { me }) {
  const oldSub = await models.sub.findUnique({
    where: {
      name: oldName
    }
  })

  const mcost = satsToMsats(proratedBillingCost(oldSub, billingType) ?? 0)
  const beneficiaries = []
  if (uploadIds.length > 0) {
    beneficiaries.push(await MEDIA_UPLOAD.getInitial(models, { uploadIds }, { me }))
  }

  return {
    payInType: 'TERRITORY_UPDATE',
    userId: me?.id,
    mcost: mcost + getBeneficiariesMcost(beneficiaries),
    payOutCustodialTokens: [{
      payOutType: 'SYSTEM_REVENUE', userId: USER_ID.sn, mtokens: mcost, custodialTokenType: 'SATS'
    }],
    beneficiaries
  }
}

export async function onBegin (tx, payInId, { oldName, billingType, uploadIds, ...data }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId } })
  const oldSub = await tx.sub.findUnique({
    where: {
      name: oldName
    }
  })

  data.billingCost = TERRITORY_PERIOD_COST(billingType)

  // we never want to bill them again if they are changing to ONCE
  if (billingType === 'ONCE') {
    data.billPaidUntil = null
    data.billingAutoRenew = false
  }

  // if they are changing to YEARLY, bill them in a year
  // if they are changing to MONTHLY from YEARLY, do nothing
  if (oldSub.billingType === 'MONTHLY' && billingType === 'YEARLY') {
    data.billPaidUntil = datePivot(new Date(oldSub.billedLastAt), { years: 1 })
  }

  // if this billing change makes their bill paid up, set them to active
  if (data.billPaidUntil === null || data.billPaidUntil >= new Date()) {
    data.status = 'ACTIVE'
  }

  return await tx.sub.update({
    data: {
      ...data,
      subPayIn: {
        create: [{ payInId }]
      }
    },
    where: {
      // optimistic concurrency control
      // make sure none of the relevant fields have changed since we fetched the sub
      ...oldSub,
      postTypes: {
        equals: oldSub.postTypes
      },
      name: oldName,
      userId: payIn.userId
    }
  })
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { subPayIn: true, pessimisticEnv: true } })
  const subName = payIn.subPayIn?.subName || payIn.pessimisticEnv?.args?.name
  return `SN: update territory billing ${subName}`
}
