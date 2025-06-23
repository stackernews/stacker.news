import { createHash } from 'crypto'
import { bech32 } from 'bech32'
import { lnAddrSchema } from './validate'
import { FetchTimeoutError } from '@/lib/fetch'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from './constants'
import { assertContentTypeJson, assertResponseOk, ResponseAssertError } from '@/lib/url'

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

  const unexpectedErrorMessage = 'Lightning address validation failed. Make sure you entered the correct address.'
  let body
  const method = 'GET'
  const url = `${protocol}://${domain}/.well-known/lnurlp/${name}`
  try {
    const res = await fetch(url, { method, signal })
    assertResponseOk(res, { method })
    assertContentTypeJson(res, { method })
    body = await res.json()
  } catch (err) {
    console.log('Error fetching lnurlp:', err)
    if (err instanceof ResponseAssertError) {
      throw err
    }
    if (err.name === 'TimeoutError') {
      throw new FetchTimeoutError('GET', url, WALLET_CREATE_INVOICE_TIMEOUT_MS)
    }
    if (err.name === 'SyntaxError') {
      throw new Error(`GET ${url}: invalid JSON`)
    }
    throw new Error(unexpectedErrorMessage)
  }
  if (body.status === 'ERROR') {
    // if the response doesn't adhere to spec by providing a `reason` entry, returns a default error message
    throw new Error(body.reason ?? unexpectedErrorMessage)
  }

  const { minSendable, maxSendable, ...leftOver } = body
  return { min: minSendable / 1000, max: maxSendable / 1000, ...leftOver }
}
