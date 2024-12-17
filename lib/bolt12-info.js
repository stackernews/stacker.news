import { deserializeTLVStream } from './tlv'
import * as bech32b12 from '@/lib/bech32b12'

export function isBolt12 (invoice) {
  return invoice.startsWith('lni1') || invoice.startsWith('lno1')
}

export function bolt12Info (bolt12) {
  if (!isBolt12(bolt12)) throw new Error('not a bolt12 invoice or offer')
  const buf = bech32b12.decode(bolt12.substring(4)/* remove lni1 or lno1 prefix */)
  const tlv = deserializeTLVStream(buf)
  const INFO_TYPES = {
    description: 10n,
    payment_hash: 168n
  }
  const info = {
    description: '',
    payment_hash: ''
  }
  for (const { type, value } of tlv) {
    if (type === INFO_TYPES.description) {
      info.description = value.toString()
    } else if (type === INFO_TYPES.payment_hash) {
      info.payment_hash = value.toString('hex')
    }
  }
  return info
}
