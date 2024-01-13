import { createHash } from 'crypto'
import { bech32 } from 'bech32'
import { lnAddrSchema } from './validate'

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

export async function lnAddrOptions (addr) {
  await lnAddrSchema().fields.addr.validate(addr)
  const [name, domain] = addr.split('@')
  let protocol = 'https'
  if (process.env.NODE_ENV === 'development') {
    // support HTTP and HTTPS during development
    protocol = process.env.PUBLIC_URL.split('://')[0]
  }
  const req = await fetch(`${protocol}://${domain}/.well-known/lnurlp/${name}`)
  const res = await req.json()
  if (res.status === 'ERROR') {
    throw new Error(res.reason)
  }

  const { minSendable, maxSendable, ...leftOver } = res
  return { min: minSendable / 1000, max: maxSendable / 1000, ...leftOver }
}
