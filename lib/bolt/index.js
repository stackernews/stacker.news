import { getBolt11Description, getBolt11PaymentHash } from '@/lib/bolt/bolt11-tags'
import { getBolt12Description, getBolt12PaymentHash, isBolt12 } from '@/lib/bolt/bolt12-info'

export function getInvoiceDescription (bolt) {
  if (isBolt12(bolt)) return getBolt12Description(bolt)
  return getBolt11Description(bolt)
}

export function getInvoicePaymentHash (bolt) {
  if (isBolt12(bolt)) return getBolt12PaymentHash(bolt)
  return getBolt11PaymentHash(bolt)
}
