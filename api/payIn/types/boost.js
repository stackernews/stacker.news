import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC
]

async function getPayOuts (models, { sats, id, sub }, { me }) {
  if (id) {
    sub = (await models.item.findUnique({ where: { id }, include: { sub: true } })).sub
  }

  if (!sub) {
    throw new Error('Sub not found')
  }

  const revenueMsats = satsToMsats(sats * sub.rewardsPct / 100)
  const rewardMsats = satsToMsats(sats - revenueMsats)

  // TODO: this won't work for beneficiaries on itemCreate
  return {
    payOutCustodialTokens: [
      {
        payOutType: 'TERRITORY_REVENUE',
        userId: sub.userId,
        mtokens: revenueMsats,
        custodialTokenType: 'SATS',
        subPayOutCustodialToken: {
          subName: sub.name
        }
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

export async function getInitial (models, payInArgs, { me }) {
  const { sats } = payInArgs
  const payIn = {
    payInType: 'BOOST',
    userId: me?.id,
    mcost: satsToMsats(sats)
  }

  return { ...payIn, ...(await getPayOuts(models, payInArgs, { me })) }
}

export async function onBegin (tx, payInId, { sats, id }, { me }) {
  await tx.itemPayIn.create({
    data: {
      itemId: parseInt(id),
      payInId
    }
  })
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  await tx.itemPayIn.update({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { itemPayIn: true } })

  // increment boost on item
  await tx.item.update({
    where: { id: payIn.itemPayIn.itemId },
    data: {
      boost: { increment: msatsToSats(payIn.mcost) }
    }
  })

  // TODO: expireBoost job needs to be updated to use payIn
  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, keepuntil)
    VALUES ('expireBoost', jsonb_build_object('id', ${payIn.itemPayIn.itemId}::INTEGER), 21, true,
              now() + interval '30 days', now() + interval '40 days')`
}

export async function describe (models, payInId, { me }) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { itemPayIn: true } })
  return `SN: boost #${payIn.itemPayIn.itemId} by ${numWithUnits(msatsToSats(payIn.mcost), { abbreviate: false })}`
}
