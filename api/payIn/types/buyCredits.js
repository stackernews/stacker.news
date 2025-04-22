import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, satsToMsats } from '@/lib/format'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getCost (models, { credits }, { me }) {
  return satsToMsats(credits)
}

export async function getPayOuts (models, { credits }, { me }) {
  return {
    payOutCustodialTokens: [
      {
        payOutType: 'CREDITS',
        userId: me.id,
        mtokens: credits,
        custodialTokenType: 'CREDITS'
      }
    ]
  }
}

export async function describe (models, payInId, { me }) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId } })
  return `SN: buy ${numWithUnits(payIn.mcost, { abbreviate: false, unitSingular: 'credit', unitPlural: 'credits' })}`
}
