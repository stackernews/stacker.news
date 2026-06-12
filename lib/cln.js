import crypto from 'crypto'
import { assertContentTypeJson, assertResponseOk } from './url'
import { snFetch } from './fetch'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from './constants'

export const createInvoice = async ({ msats, description, expiry }, { socket, rune, cert }, { signal }) => {
  const method = 'POST'
  return await clnFetchJson(socket, {
    path: '/v1/invoice',
    method,
    cert,
    body: {
      // CLN requires a unique label for every invoice
      // see https://docs.corelightning.org/reference/lightning-invoice
      label: crypto.randomBytes(16).toString('hex'),
      description,
      amount_msat: msats,
      expiry
    },
    signal,
    timeout: WALLET_CREATE_INVOICE_TIMEOUT_MS
  }, { rune })
}

export const sendPayment = async (bolt11, { socket, rune }, { signal, maxFee }) => {
  // XXX we don't ask for the CA certificate because the browser's fetch API doesn't support http agents to override it.
  // Therefore, CLNRest send will only work with common CA certificates.

  // API documentation
  // https://docs.corelightning.org/reference/pay
  const method = 'POST'
  const body = { bolt11 }
  if (maxFee !== undefined && maxFee !== null) {
    // Fail closed: an unparseable max fee must not silently fall back to
    // unbounded routing fees.
    if (!Number.isSafeInteger(maxFee) || maxFee < 0) {
      throw new Error(`invalid maxFee: ${maxFee}`)
    }
    body.maxfee = `${maxFee * 1000}msat`
  }
  const result = await clnFetchJson(socket, {
    path: '/v1/pay',
    method,
    body,
    signal
  }, { rune })
  return result.payment_preimage
}

export const getBalance = async ({ socket, rune }, { signal }) => {
  const method = 'POST'
  const result = await clnFetchJson(socket, {
    path: '/v1/bkpr-listbalances',
    method,
    body: {},
    signal
  }, { rune })

  // bkpr keeps one account per channel (channel accounts have a peer_id; the
  // on-chain "wallet"/"external" accounts don't), so summing the open channel
  // accounts yields our off-chain balance.
  return (result.accounts ?? [])
    .filter(account => account.peer_id && !account.account_closed)
    .flatMap(account => account.balances ?? [])
    .reduce((total, balance) => total + msats(balance.balance_msat), 0n)
}

export function runeMayAllowMethod (rune, method) {
  const decoded = decodeRune(rune)
  if (!decoded) return false

  return decoded.restrictions.every(restriction => {
    const methodAlternatives = restriction.alternatives.filter(isMethodAlternative)
    if (methodAlternatives.length !== restriction.alternatives.length) return true

    return methodAlternatives.some(alternative => runeMethodAlternativeAllows(alternative, method))
  })
}

async function clnFetchJson (socket, { path, method, body, signal, timeout, cert }, { rune }) {
  const res = await snFetch(socket, {
    path,
    protocol: process.env.NODE_ENV === 'development' ? 'http' : 'https',
    method,
    headers: headers(rune),
    cert,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    timeout
  })

  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const result = await res.json()
  if (result.error) {
    throw new Error(result.error.message ?? result.error)
  }
  return result
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

// Exported for unit tests. Internal callers (e.g. getBalance) should use this
// helper rather than parsing CLN amount fields ad-hoc.
export function msats (amount) {
  if (typeof amount === 'bigint') return amount
  if (typeof amount === 'number') return BigInt(amount)
  if (typeof amount === 'string') return BigInt(amount.replace(/msat$/, ''))
  if (amount?.msat != null) return msats(amount.msat)
  // Fail closed: an unknown amount shape must not silently become 0 sats,
  // since callers (e.g. balance) sum these into financial totals.
  throw new Error(`unrecognized CLN amount shape: ${describeAmount(amount)}`)
}

function describeAmount (amount) {
  if (amount === null) return 'null'
  if (amount === undefined) return 'undefined'
  if (typeof amount !== 'object') return `${typeof amount}`
  // List keys only to avoid leaking sensitive values into thrown messages.
  return `object{keys=${Object.keys(amount).join(',') || 'none'}}`
}

// https://github.com/clams-tech/rune-decoder/blob/57c2e76d1ef9ab7336f565b99de300da1c7b67ce/src/index.ts
export const decodeRune = (rune) => {
  const runeBinary = Buffer.from(rune, 'base64')
  const hashBinary = runeBinary.slice(0, 32)
  const hash = Buffer.from(hashBinary).toString('hex')
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

const runeOperatorRegex = /[=^$/~<>{}#!]/g

function runeAlternativeParts (alternative) {
  const [operator] = alternative.match(runeOperatorRegex) || []
  if (!operator) return {}

  const [name, value] = alternative.split(operator)
  return { name, operator, value }
}

function isMethodAlternative (alternative) {
  return runeAlternativeParts(alternative).name === 'method'
}

function runeMethodAlternativeAllows (alternative, method) {
  const { operator, value } = runeAlternativeParts(alternative)

  switch (operator) {
    case '=':
      return method === value
    case '^':
      return method.startsWith(value)
    case '$':
      return method.endsWith(value)
    case '/':
      return method !== value
    case '~':
      return method.includes(value)
    case '<':
    case '>':
      return false
    case '{':
      return method < value
    case '}':
      return method > value
    case '!':
      return false
    default:
      return true
  }
}

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
