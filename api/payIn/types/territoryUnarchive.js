import { PAID_ACTION_PAYMENT_METHODS, TERRITORY_PERIOD_COST, USER_ID } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { nextBilling } from '@/lib/territory'
import { initialTrust } from '../lib/territory'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { billingType }, { me }) {
  const mcost = satsToMsats(TERRITORY_PERIOD_COST(billingType))
  return {
    payInType: 'TERRITORY_UNARCHIVE',
    userId: me?.id,
    mcost,
    payOutCustodialTokens: [
      { payOutType: 'SYSTEM_REVENUE', userId: USER_ID.sn, mtokens: mcost, custodialTokenType: 'SATS' }
    ]
  }
}

export async function onBegin (tx, payInId, { name, billingType, ...data }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId } })
  const sub = await tx.sub.findUnique({
    where: {
      name
    }
  })

  data.billingCost = TERRITORY_PERIOD_COST(billingType)

  // we never want to bill them again if they are changing to ONCE
  if (billingType === 'ONCE') {
    data.billPaidUntil = null
    data.billingAutoRenew = false
  }

  data.billedLastAt = new Date()
  data.billPaidUntil = nextBilling(data.billedLastAt, billingType)
  data.status = 'ACTIVE'
  data.userId = payIn.userId

  if (sub.userId !== payIn.userId) {
    try {
      // this will throw if this transfer has already happened
      await tx.territoryTransfer.create({ data: { subName: name, oldUserId: sub.userId, newUserId: payIn.userId } })
      // this will throw if the prior user has already unsubscribed
      await tx.subSubscription.delete({ where: { userId_subName: { userId: sub.userId, subName: name } } })
    } catch (e) {
      console.error(e)
    }
  }

  await tx.subSubscription.upsert({
    where: {
      userId_subName: {
        userId: payIn.userId,
        subName: name
      }
    },
    update: {
      userId: payIn.userId,
      subName: name
    },
    create: {
      userId: payIn.userId,
      subName: name
    }
  })

  const updatedSub = await tx.sub.update({
    data: {
      ...data,
      billingType,
      subPayIn: { create: [{ payInId }] }
    },
    // optimistic concurrency control
    // make sure none of the relevant fields have changed since we fetched the sub
    where: {
      ...sub,
      postTypes: {
        equals: sub.postTypes
      }
    }
  })

  const trust = initialTrust({ name: updatedSub.name, userId: updatedSub.userId })
  for (const t of trust) {
    await tx.userSubTrust.upsert({
      where: {
        userId_subName: { userId: t.userId, subName: t.subName }
      },
      update: t,
      create: t
    })
  }

  return updatedSub
}

export async function describe (models, payInId) {
  const { sub } = await models.subPayIn.findUnique({ where: { payInId }, include: { sub: true } })
  return `SN: unarchive territory ${sub.name}`
}
