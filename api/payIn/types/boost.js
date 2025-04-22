import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC
]

export async function getCost (models, { sats }, { me }) {
  return satsToMsats(sats)
}

export async function getPayOuts (models, payIn, { sats, id }, { me }) {
  const item = await models.item.findUnique({ where: { id }, include: { sub: true } })

  const revenueMsats = satsToMsats(sats * item.sub.rewardsPct / 100)
  const rewardMsats = satsToMsats(sats - revenueMsats)

  return {
    payOutCustodialTokens: [
      {
        payOutType: 'TERRITORY_REVENUE',
        userId: item.sub.userId,
        mtokens: revenueMsats,
        custodialTokenType: 'SATS'
      },
      {
        payOutType: 'REWARD_POOL',
        userId: null,
        mtokens: rewardMsats,
        custodialTokenType: 'SATS'
      }
    ]
  }
}

// TODO: continue with renaming perform to onPending?
// TODO: migrate ItemAct to this simple model of itemId and payInId?
export async function onPending (tx, payInId, { sats, id }, { me }) {
  const itemId = parseInt(id)

  return await tx.itemAct.create({
    data: {
      itemId,
      payInId
    }
  })
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  await tx.itemAct.update({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
}

export async function onPaid (tx, payInId) {
  const itemAct = await tx.itemAct.findUnique({ where: { payInId }, include: { item: true } })

  // increment boost on item
  await tx.item.update({
    where: { id: itemAct.itemId },
    data: {
      boost: { increment: msatsToSats(itemAct.msats) }
    }
  })

  // TODO: migrate SubAct to this simple model of subName and payInId?
  // ??? is this the right place for this?
  await tx.subAct.create({
    data: {
      subName: itemAct.item.subName,
      payInId
    }
  })

  // TODO: expireBoost job needs to be updated to use payIn
  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, keepuntil)
    VALUES ('expireBoost', jsonb_build_object('id', ${itemAct.itemId}::INTEGER), 21, true,
              now() + interval '30 days', now() + interval '40 days')`
}

export async function describe (models, payInId, { me }) {
  const itemAct = await models.itemAct.findUnique({ where: { payInId }, include: { item: true } })
  return `SN: boost #${itemAct.itemId} by ${numWithUnits(msatsToSats(itemAct.msats), { abbreviate: false })}`
}
