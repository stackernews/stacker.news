import { decode } from 'bolt11'
import { bolt11InvoiceSchema } from '@/lib/validate'

export function isBolt11 (request) {
  return bolt11InvoiceSchema.isValidSync(request)
}

export function bolt11Tags (bolt11) {
  if (!isBolt11(bolt11)) throw new Error('not a bolt11 invoice')
  return decode(bolt11).tagsObject
}
