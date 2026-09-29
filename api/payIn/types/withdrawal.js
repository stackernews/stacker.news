import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { satsToMsats, numWithUnits, msatsToSats } from '@/lib/format'
import { decodePaymentRequest } from '@/api/lnd'
import { assertValidBolt11, logInvalidBolt11 } from '@/lib/bolt11-validator'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS
]

export async function getInitial (models, { bolt11, maxFee, protocolId }, { me }) {
  // the withdrawal payout row is built from this invoice. validate syntax
  // before everything else and kill it if it doesn't pass
  try {
    assertValidBolt11(bolt11)
  } catch (err) {
    logInvalidBolt11('refusing to initiate withdrawal', err)
    throw err
  }
  const decodedBolt11 = await decodePaymentRequest({ request: bolt11 })
  return {
    payInType: 'WITHDRAWAL',
    userId: me?.id,
    mcost: BigInt(decodedBolt11.mtokens) + satsToMsats(maxFee),
    payOutBolt11: {
      payOutType: 'WITHDRAWAL',
      msats: BigInt(decodedBolt11.mtokens),
      bolt11,
      hash: decodedBolt11.id,
      userId: me.id,
      protocolId
    },
    payOutCustodialTokens: [
      {
        payOutType: 'ROUTING_FEE',
        userId: null,
        mtokens: satsToMsats(maxFee),
        custodialTokenType: 'SATS'
      }
    ]
  }
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { payOutBolt11: true } })
  return `SN: withdraw ${numWithUnits(msatsToSats(payIn.payOutBolt11.msats))}`
}
