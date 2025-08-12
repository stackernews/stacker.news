import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, msatsToSats } from '@/lib/format'
import { payOutBolt11Prospect } from '../lib/payOutBolt11'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS
]

export async function getInitial (models, { msats, maxFeeMsats }, { me }) {
  const payOutBolt11 = await payOutBolt11Prospect(models, { payOutType: 'WITHDRAWAL', msats }, { me })
  return {
    payInType: 'AUTO_WITHDRAWAL',
    userId: me?.id,
    mcost: msats + maxFeeMsats,
    payOutBolt11,
    payOutCustodialTokens: [
      {
        payOutType: 'ROUTING_FEE',
        userId: null,
        mtokens: maxFeeMsats,
        custodialTokenType: 'SATS'
      }
    ]
  }
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { payOutBolt11: true } })
  return `SN: auto-withdraw ${numWithUnits(msatsToSats(payIn.payOutBolt11.msats))}`
}
