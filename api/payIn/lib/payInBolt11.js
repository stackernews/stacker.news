import { datePivot } from '@/lib/time'
import { createHodlInvoice, createInvoice, parsePaymentRequest } from 'ln-service'
import lnd from '@/api/lnd'
import { wrapBolt11 } from '@/wallets/server'
import { payInTypeModules } from '../types'

const INVOICE_EXPIRE_SECS = 600

function payInBolt11FromBolt11 (bolt11) {
  const decodedBolt11 = parsePaymentRequest({ request: bolt11 })
  const expiresAt = new Date(decodedBolt11.expires_at)
  const msatsRequested = BigInt(decodedBolt11.mtokens)
  return {
    hash: decodedBolt11.id,
    bolt11,
    msatsRequested,
    expiresAt
  }
}

// TODO: throw errors that give us PayInFailureReason
export async function getPayInBolt11 (models, { mCostRemaining, payIn }, { me }) {
  const createLNDinvoice = payIn.pessimisticEnv ? createHodlInvoice : createInvoice
  const expiresAt = datePivot(new Date(), { seconds: INVOICE_EXPIRE_SECS })
  const invoice = await createLNDinvoice({
    description: payIn.user?.hideInvoiceDesc ? undefined : await payInTypeModules[payIn.payInType].describe(models, payIn.id, { me }),
    mtokens: String(mCostRemaining),
    expires_at: expiresAt,
    lnd
  })

  return payInBolt11FromBolt11(invoice.request)
}

export async function getPayInBolt11Wrap (models, { mCostRemaining, payIn }, { me }) {
  const bolt11 = await wrapBolt11({ msats: mCostRemaining, bolt11: payIn.payOutBolt11.bolt11, expiry: INVOICE_EXPIRE_SECS }, { models, me })
  return payInBolt11FromBolt11(bolt11)
}
