import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'

export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { sats }, { me }) {
  return {
    payInType: 'DONATE',
    userId: me?.id,
    mcost: satsToMsats(sats),
    payOutCustodialTokens: [
      { payOutType: 'REWARDS_POOL', userId: null, mtokens: satsToMsats(sats), custodialTokenType: 'SATS' }
    ]
  }
}

export async function describe (models, payInId, { me }) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId } })
  return `SN: donate ${numWithUnits(msatsToSats(payIn.mcost), { abbreviate: false })} to rewards pool`
}
