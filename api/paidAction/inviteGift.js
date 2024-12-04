import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { notifyInvite } from '@/lib/webPush'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS
]

export async function getCost ({ id }, { models, me }) {
  const invite = await models.invite.findUnique({ where: { id, userId: me.id, revoked: false } })
  if (!invite) {
    throw new Error('invite not found')
  }
  return satsToMsats(invite.gift)
}

export async function perform ({ id, userId }, { me, cost, tx }) {
  const invite = await tx.invite.findUnique({
    where: { id, userId: me.id, revoked: false }
  })

  if (invite.giftedCount >= invite.limit) {
    throw new Error('invite limit reached')
  }

  // check that user was created in last hour
  // check that user did not already redeem an invite
  await tx.user.update({
    where: {
      id: userId,
      inviteId: { is: null },
      createdAt: {
        gt: new Date(Date.now() - 1000 * 60 * 60)
      }
    },
    data: {
      mcredits: {
        increment: cost
      },
      inviteId: id,
      referrerId: me.id
    }
  })

  return await tx.invite.update({
    where: { id, userId: me.id, giftedCount: { lt: invite.limit }, revoked: false },
    data: {
      giftedCount: {
        increment: 1
      }
    }
  })
}

export async function nonCriticalSideEffects (_, { me }) {
  notifyInvite(me.id)
}
