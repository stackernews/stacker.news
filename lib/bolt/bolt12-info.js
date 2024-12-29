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

export function bolt12Info (bolt12) {
  if (!isBolt12(bolt12)) throw new Error('not a bolt12 invoice or offer')
  const buf = bech32b12.decode(bolt12.substring(4)/* remove lni1 or lno1 prefix */)
  const tlv = deserializeTLVStream(buf)

  const info = {
    description: '',
    payment_hash: ''
  }

  for (const { type, value } of tlv) {
    if (type === TYPE_DESCRIPTION) {
      info.description = value.toString() || info.description
    } else if (type === TYPE_PAYER_NOTE) {
      info.description = value.toString() || info.description
    } else if (type === TYPE_PAYMENT_HASH) {
      info.payment_hash = value.toString('hex')
    }
  }

  return info
}
