import crossFetch from 'cross-fetch'
import crypto from 'crypto'
import { getAgent } from '@/lib/proxy'
import { assertContentTypeJson, assertResponseOk } from './url'
import { fetchWithTimeout, FetchTimeoutError } from './fetch'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from './constants'

export const createInvoice = async ({ msats, description, expiry }, { socket, rune, cert }, { signal }) => {
  const agent = getAgent({ hostname: socket, cert })

  const url = `${agent.protocol}//${socket}/v1/invoice`

  const method = 'POST'
  let res
  try {
    res = await crossFetch(url, {
      method,
      headers: headers(rune),
      agent,
      body: JSON.stringify({
        // CLN requires a unique label for every invoice
        // see https://docs.corelightning.org/reference/lightning-invoice
        label: crypto.randomBytes(16).toString('hex'),
        description,
        amount_msat: msats,
        expiry
      }),
      signal
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      // XXX node-fetch doesn't throw our custom TimeoutError but throws a generic error so we have to handle that manually.
      // see https://github.com/node-fetch/node-fetch/issues/1462
      throw new FetchTimeoutError('POST', url, WALLET_CREATE_INVOICE_TIMEOUT_MS)
    }
    throw err
  }

  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const inv = await res.json()
  if (inv.error) {
    throw new Error(inv.error.message)
  }
  return inv
}

export const sendPayment = async (bolt11, { socket, rune }, { signal }) => {
  // XXX we don't ask for the CA certificate because the browser's fetch API doesn't support http agents to override it.
  // Therefore, CLNRest send will only work with common CA certificates.

  // API documentation
  // https://docs.corelightning.org/reference/pay
  const url = new URL(
    '/v1/pay',
    process.env.NODE_ENV === 'development' ? `http://${socket}` : `https://${socket}`)
  const method = 'POST'
  const res = await fetchWithTimeout(url, {
    method,
    headers: headers(rune),
    body: JSON.stringify({ bolt11 }),
    signal
  })
  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const result = await res.json()
  if (result.error) {
    throw new Error(result.error.message)
  }
  return result.payment_preimage
}

function headers (rune) {
  const headers = new Headers()
  headers.append('Content-Type', 'application/json')
  headers.append('Rune', rune)
  // can be any node id, only required for CLN v23.08 and below
  // see https://docs.corelightning.org/docs/rest#server
  headers.append('nodeId', '02cb2e2d5a6c5b17fa67b1a883e2973c82e328fb9bd08b2b156a9e23820c87a490')
  return headers
}

// https://github.com/clams-tech/rune-decoder/blob/57c2e76d1ef9ab7336f565b99de300da1c7b67ce/src/index.ts
export const decodeRune = (rune) => {
  const runeBinary = Base64Binary.decode(rune)
  const hashBinary = runeBinary.slice(0, 32)
  const hash = binaryHashToHex(hashBinary)
  const restBinary = runeBinary.slice(32)

  const [uniqueId, ...restrictionStrings] = new TextDecoder().decode(restBinary).split('&')

  const id = uniqueId.split('=')[1]

  // invalid rune checks
  if (!id) return null
  if (restrictionStrings.some(invalidAscii)) return null

  const restrictions = restrictionStrings.map((restriction) => {
    const alternatives = restriction.split('|')

    const summary = alternatives.reduce((str, alternative) => {
      const [operator] = alternative.match(runeOperatorRegex) || []
      if (!operator) return str

      const [name, value] = alternative.split(operator)

      return `${str ? `${str} OR ` : ''}${name} ${operatorToDescription(operator)} ${value}`
    }, '')

    return {
      alternatives,
      summary
    }
  })

  return {
    id,
    hash,
    restrictions
  }
}

const Base64Binary = {
  _keyStr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',

  removePaddingChars: function (input) {
    const lkey = this._keyStr.indexOf(input.charAt(input.length - 1))

    if (lkey === 64) {
      return input.substring(0, input.length - 1)
    }

    return input
  },

  decode: function (input) {
    // get last chars to see if are valid
    input = this.removePaddingChars(input)
    input = this.removePaddingChars(input)

    const bytes = parseInt(((input.length / 4) * 3).toString(), 10)

    let chr1, chr2, chr3
    let enc1, enc2, enc3, enc4
    let i = 0
    let j = 0

    const uarray = new Uint8Array(bytes)

    for (i = 0; i < bytes; i += 3) {
      // get the 3 octects in 4 ascii chars
      enc1 = this._keyStr.indexOf(input.charAt(j++))
      enc2 = this._keyStr.indexOf(input.charAt(j++))
      enc3 = this._keyStr.indexOf(input.charAt(j++))
      enc4 = this._keyStr.indexOf(input.charAt(j++))

      chr1 = (enc1 << 2) | (enc2 >> 4)
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
      chr3 = ((enc3 & 3) << 6) | enc4

      uarray[i] = chr1
      if (enc3 !== 64) uarray[i + 1] = chr2
      if (enc4 !== 64) uarray[i + 2] = chr3
    }

    return uarray
  }
}

function i2hex (i) {
  return ('0' + i.toString(16)).slice(-2)
}

const binaryHashToHex = (hash) => {
  return hash.reduce(function (memo, i) {
    return memo + i2hex(i)
  }, '')
}

const runeOperatorRegex = /[=^$/~<>{}#!]/g

const operatorToDescription = (operator) => {
  switch (operator) {
    case '=':
      return 'is equal to'
    case '^':
      return 'starts with'
    case '$':
      return 'ends with'
    case '/':
      return 'is not equal to'
    case '~':
      return 'contains'
    case '<':
      return 'is less than'
    case '>':
      return 'is greater than'
    case '{':
      return 'sorts before'
    case '}':
      return 'sorts after'
    case '#':
      return 'comment'
    case '!':
      return 'is missing'
    default:
      return ''
  }
}

const invalidAscii = (str) => !![...str].some((char) => char.charCodeAt(0) > 127)
