import { randomBytes, createHash } from 'crypto'
import { bech32 } from 'bech32'

export function lnurlAuth (params) {
  // generate secret (32 random bytes)
  const secret = Buffer.from(randomBytes(32), 'hex')
  // create url
  const url = new URL(process.env.LNAUTH_URL)
  url.searchParams = new URLSearchParams({
    ...params,
    k1: secret
  })
  // bech32 encode url
  const words = bech32.toWords(Buffer.from(url.toString(), 'utf8'))
  const encodedUrl = bech32.encode('lnurl', words, 1023)
  return { secret, encodedUrl }
}

export function lnurlPayMetadataString (username) {
  return JSON.stringify([[
    'text/plain',
    `Funding @${username} on stacker.news`
  ]])
}

export function lnurlPayDescriptionHash (username) {
  return createHash('sha256').update(lnurlPayMetadataString(username)).digest('hex')
}
