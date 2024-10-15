// XXX we don't use this yet ...
// it's just showing that even buying credits
// can eventually be a paid action

import { USER_ID } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'

export const anonable = false
export const supportsPessimism = false
export const supportsOptimism = true

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
