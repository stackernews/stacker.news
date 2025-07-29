import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { parsePaymentRequest } from 'ln-service'
import { satsToMsats, numWithUnits, msatsToSats } from '@/lib/format'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS
]

export async function getInitial (models, { bolt11, maxFee, protocolId }, { me }) {
  const invoice = parsePaymentRequest({ request: bolt11 })
  return {
    payInType: 'WITHDRAWAL',
    userId: me?.id,
    mcost: BigInt(invoice.mtokens) + satsToMsats(maxFee),
    payOutBolt11: {
      payOutType: 'WITHDRAWAL',
      msats: BigInt(invoice.mtokens),
      bolt11: invoice.bolt11,
      hash: invoice.hash,
      userId: me.id,
      protocolId
    },
    payOutCustodialTokens: [
      {
        payOutType: 'ROUTING_FEE',
        userId: null,
        mtokens: satsToMsats(maxFee)
      }
    ]
  }
}

export async function describe (models, payInId, { me }) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { payOutBolt11: true } })
  return `SN: withdraw ${numWithUnits(msatsToSats(payIn.payOutBolt11.msats))}`
}
