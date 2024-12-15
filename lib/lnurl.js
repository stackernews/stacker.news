import { createHash } from 'crypto'
import { bech32 } from 'bech32'
import { lnAddrSchema } from './validate'
import { FetchTimeoutError } from '@/lib/fetch'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from './constants'

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

export async function lnAddrOptions (addr, { signal } = {}) {
  await lnAddrSchema().fields.addr.validate(addr)
  const [name, domain] = addr.split('@')
  let protocol = 'https'
  if (process.env.NODE_ENV === 'development') {
    // support HTTP and HTTPS during development
    protocol = process.env.NEXT_PUBLIC_URL.split('://')[0]
  }
  const unexpectedErrorMessage = `An unexpected error occurred fetching the Lightning Address metadata for ${addr}. Check the address and try again.`
  let res
  const url = `${protocol}://${domain}/.well-known/lnurlp/${name}`
  try {
    const req = await fetch(url, { signal })
    res = await req.json()
  } catch (err) {
    console.log('Error fetching lnurlp', err)
    if (err.name === 'TimeoutError') {
      throw new FetchTimeoutError('GET', url, WALLET_CREATE_INVOICE_TIMEOUT_MS)
    }
    // If `fetch` fails, or if `req.json` fails, catch it here and surface a reasonable error
    throw new Error(unexpectedErrorMessage)
  }
  if (res.status === 'ERROR') {
    // if the response doesn't adhere to spec by providing a `reason` entry, returns a default error message
    throw new Error(res.reason ?? unexpectedErrorMessage)
  }

  const { minSendable, maxSendable, ...leftOver } = res
  return { min: minSendable / 1000, max: maxSendable / 1000, ...leftOver }
}
