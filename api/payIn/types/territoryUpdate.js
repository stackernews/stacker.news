import { throwOnExpiredUploads } from '@/api/resolvers/upload'
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
    payOutCustodialTokens: mcost > 0n ? [{ payOutType: 'SYSTEM_REVENUE', userId: null, mtokens: mcost, custodialTokenType: 'SATS' }] : []
  }
}

export async function onBegin (tx, payInId, { oldName, billingType, ...data }) {
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

  // TODO: this is nasty
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
  const { sub } = await models.subPayIn.findUnique({ where: { payInId }, include: { sub: true } })
  return `SN: update territory billing ${sub.name}`
}
