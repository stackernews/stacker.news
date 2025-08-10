import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, satsToMsats } from '@/lib/format'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { credits }, { me }) {
  return {
    payInType: 'BUY_CREDITS',
    userId: me?.id,
    mcost: satsToMsats(credits),
    payOutCustodialTokens: [
      {
        payOutType: 'BUY_CREDITS',
        userId: me.id,
        mtokens: satsToMsats(credits),
        custodialTokenType: 'CREDITS'
      }
    ]
  }
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId } })
  return `SN: buy ${numWithUnits(payIn.mcost, { abbreviate: false, unitSingular: 'credit', unitPlural: 'credits' })}`
}
