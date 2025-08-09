import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { notifyInvite } from '@/lib/webPush'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS
]

export async function getInitial (models, { id, userId }, { me }) {
  const invite = await models.invite.findUnique({ where: { id, userId: me.id, revoked: false } })
  if (!invite) {
    throw new Error('invite not found')
  }
  const mcost = satsToMsats(invite.gift)
  return {
    payInType: 'INVITE_GIFT',
    userId: me?.id,
    mcost,
    payOutCustodialTokens: [
      {
        payOutType: 'INVITE_GIFT',
        userId,
        mtokens: mcost,
        custodialTokenType: 'CREDITS'
      }
    ]
  }
}

export async function onBegin (tx, payInId, { id, userId }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId } })

  const invite = await tx.invite.findUnique({
    where: { id, userId: payIn.userId, revoked: false }
  })

  if (invite.limit && invite.giftedCount >= invite.limit) {
    throw new Error('invite limit reached')
  }

  // check that user was created in last hour
  // check that user did not already redeem an invite
  await tx.user.update({
    where: {
      id: userId,
      inviteId: null,
      createdAt: {
        gt: new Date(Date.now() - 1000 * 60 * 60)
      }
    },
    data: {
      inviteId: id,
      referrerId: payIn.userId
    }
  })

  await tx.invite.update({
    where: { id, userId: payIn.userId, revoked: false, ...(invite.limit ? { giftedCount: { lt: invite.limit } } : {}) },
    data: {
      giftedCount: {
        increment: 1
      }
    }
  })
}

export async function onPaidSideEffects (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId } })
  notifyInvite(payIn.userId)
}
