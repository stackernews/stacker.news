import { deserializeTLVStream } from '../tlv'
import * as bech32b12 from '@/lib/bech32b12'

import { bolt12OfferSchema, bolt12InvoiceSchema } from '../validate'

const TYPE_DESCRIPTION = 10n
const TYPE_PAYER_NOTE = 89n
const TYPE_PAYMENT_HASH = 168n

export function isBolt12Offer (invoice) {
  return bolt12OfferSchema.isValidSync(invoice)
}

export function isBolt12Invoice (invoice) {
  return bolt12InvoiceSchema.isValidSync(invoice)
}

export function isBolt12 (invoice) {
  return isBolt12Offer(invoice) || isBolt12Invoice(invoice)
}

export function getBolt12Description (bolt12) {
  if (!isBolt12(bolt12)) throw new Error('not a bolt12 invoice or offer')
  const buf = bech32b12.decode(bolt12.substring(4)/* remove lni1 or lno1 prefix */)
  const tlv = deserializeTLVStream(buf)
  let description = ''
  for (const { type, value } of tlv) {
    if (type === TYPE_DESCRIPTION) {
      description = value.toString() || description
    } else if (type === TYPE_PAYER_NOTE) {
      description = value.toString() || description
      break
    }
  }
  return description
}

export function getBolt12PaymentHash (bolt12) {
  if (!isBolt12(bolt12)) throw new Error('not a bolt12 invoice or offer')
  const buf = bech32b12.decode(bolt12.substring(4)/* remove lni1 or lno1 prefix */)
  const tlv = deserializeTLVStream(buf)
  const paymentHash = tlv.find(({ type }) => type === TYPE_PAYMENT_HASH)
  return paymentHash?.value?.toString('hex')
}
