import { PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getCost ({ amount }) {
  return satsToMsats(amount)
}

export async function onPaid ({ invoice }, { tx }) {
  return await tx.users.update({
    where: { id: invoice.userId },
    data: { balance: { increment: invoice.msatsReceived } }
  })
}

export async function describe ({ amount }, { models, me }) {
  const user = await models.user.findUnique({ where: { id: me?.id ?? USER_ID.anon } })
  return `SN: buying credits for @${user.name}`
}
