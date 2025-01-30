/* eslint-disable camelcase */
import { decode } from 'bolt11'
import { bolt11InvoiceSchema } from '@/lib/validate'

export function isBolt11 (request) {
  return bolt11InvoiceSchema.isValidSync(request)
}

function bolt11Tags (bolt11) {
  if (!isBolt11(bolt11)) throw new Error('not a bolt11 invoice')
  return decode(bolt11).tagsObject
}

export function getBolt11Description (bolt11) {
  const { description } = bolt11Tags(bolt11)
  return description
}

export function getBolt11PaymentHash (bolt11) {
  const { payment_hash } = bolt11Tags(bolt11)
  return payment_hash
}
