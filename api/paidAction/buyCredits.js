// XXX we don't use this yet ...
// it's just showing that even buying credits
// can eventually be a paid action

import { ANON_USER_ID } from '@/lib/constants'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = true

export async function getCost ({ amount }) {
  return BigInt(amount) * BigInt(1000)
}

export async function doStatements () {
  return []
}

export async function onPaidStatements ({ invoice }, { models }) {
  return [
    models.users.update({
      where: { id: invoice.userId },
      data: { balance: { increment: invoice.msatsReceived } }
    })
  ]
}

export async function resultsToResponse (results, args, context) {
  return null
}

export async function describe ({ amount }, { models, me }) {
  const user = await models.user.findUnique({ where: { id: me?.id ?? ANON_USER_ID } })
  return `SN: buying credits for @${user.name}`
}
