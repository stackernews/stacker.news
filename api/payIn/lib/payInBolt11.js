import { datePivot } from '@/lib/time'
import { createHodlInvoice, createInvoice, parsePaymentRequest } from 'ln-service'
import lnd from '@/api/lnd'
import { wrapBolt11 } from '@/wallets/server'
import { payInTypeModules } from '../types'
import { PayInFailureReasonError } from '../errors'

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

export async function payInBolt11Prospect (models, payIn, { msats }) {
  try {
    const createLNDinvoice = payIn.pessimisticEnv ? createHodlInvoice : createInvoice
    const expiresAt = datePivot(new Date(), { seconds: INVOICE_EXPIRE_SECS })
    const invoice = await createLNDinvoice({
      description: payIn.user?.hideInvoiceDesc ? undefined : await payInTypeModules[payIn.payInType].describe(models, payIn.id),
      mtokens: String(msats),
      expires_at: expiresAt,
      lnd
    })

    return payInBolt11FromBolt11(invoice.request)
  } catch (e) {
    throw new PayInFailureReasonError('Invoice creation failed', 'INVOICE_CREATION_FAILED')
  }
}

export async function payInBolt11WrapProspect (models, payIn, { msats }) {
  try {
    const bolt11 = await wrapBolt11({ msats, bolt11: payIn.payOutBolt11.bolt11, expiry: INVOICE_EXPIRE_SECS }, { models })
    return payInBolt11FromBolt11(bolt11)
  } catch (e) {
    if (e instanceof PayInFailureReasonError) {
      throw e
    }
    throw new PayInFailureReasonError('Invoice wrapping failed', 'INVOICE_WRAPPING_FAILED_UNKNOWN')
  }
}
