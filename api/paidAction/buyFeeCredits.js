import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getCost ({ credits }) {
  return satsToMsats(credits)
}

export async function perform ({ credits }, { me, cost, tx }) {
  return await tx.user.update({
    where: { id: me.id },
    data: {
      mcredits: {
        increment: cost
      }
    }
  })
}

export async function describe () {
  return 'SN: buy fee credits'
}
