import { decode } from 'bolt11'

export function isBolt11 (request) {
  return request.startsWith('lnbc') || request.startsWith('lntb') || request.startsWith('lntbs') || request.startsWith('lnbcrt')
}

export function bolt11Tags (bolt11) {
  if (!isBolt11(bolt11)) throw new Error('not a bolt11 invoice')
  return decode(bolt11).tagsObject
}
