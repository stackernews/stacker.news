import { createHash } from 'crypto'
import { bech32 } from 'bech32'

export function encodeLNUrl (url) {
  const words = bech32.toWords(Buffer.from(url.toString(), 'utf8'))
  return bech32.encode('lnurl', words, 1023)
}

export function lnurlPayMetadataString (username) {
  return JSON.stringify([[
    'text/plain',
    `Funding @${username} on stacker.news`
  ], [
    'text/identifier',
    `${username}@stacker.news`
  ]])
}

export function lnurlPayDescriptionHashForUser (username) {
  return lnurlPayDescriptionHash(lnurlPayMetadataString(username))
}

export function lnurlPayDescriptionHash (data) {
  return createHash('sha256').update(data).digest('hex')
}
