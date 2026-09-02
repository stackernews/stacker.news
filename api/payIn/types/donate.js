import { PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'

export const anonable = true

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { sats }, { me }) {
  return donationProspect({ userId: me?.id, mtokens: satsToMsats(sats) })
}

// Beneficiaries can donate fractional sats without rounding their share.
export function donationProspect ({ userId, mtokens }) {
  return {
    payInType: 'DONATE',
    userId,
    mcost: mtokens,
    payOutCustodialTokens: [
      { payOutType: 'REWARDS_POOL', userId: USER_ID.rewards, mtokens, custodialTokenType: 'SATS' }
    ]
  }
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId } })
  return `SN: donate ${numWithUnits(msatsToSats(payIn.mcost), { abbreviate: false })} to rewards pool`
}
