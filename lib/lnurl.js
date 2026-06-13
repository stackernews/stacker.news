import { createHash } from 'crypto'
import { bech32 } from 'bech32'
import { lightningAddressValidator, lnAddrSchema, lud18PayerDataSchema, validateSchema } from './validate'
import { snFetch } from './fetch'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from './constants'
import { satsToMsats } from './format'
import { isAbortLike } from './time'
import { assertContentTypeJson, assertResponseOk, ResponseAssertError } from './url'
import { assertBolt11Msats } from './bolt11'

// ===========================================================================
// SN as an LNURL provider: serving user@stacker.news
// ===========================================================================

export function encodeLnurl (url) {
  const words = bech32.toWords(Buffer.from(url.toString(), 'utf8'))
  return bech32.encode('lnurl', words, 1023)
}

export function lnurlPayMetadata (username) {
  const description = `Proxied payment to ${username}@stacker.news`
  const metadata = JSON.stringify([
    ['text/plain', description],
    ['text/identifier', `${username}@stacker.news`]
  ])
  return {
    metadata,
    description,
    descriptionHash: createHash('sha256').update(metadata).digest('hex')
  }
}

// The LUD-16 well-known path for a name, shared by the provider URL builder
// below and the client-side address resolver further down.
export function lnurlpWellKnownPath (name) {
  return `/.well-known/lnurlp/${name}`
}

export function lnurlpUrl (username, baseUrl = process.env.NEXT_PUBLIC_URL) {
  return new URL(lnurlpWellKnownPath(username), baseUrl).toString()
}

export function lnurlpCallbackUrl (username, baseUrl = process.env.NEXT_PUBLIC_URL) {
  return new URL(`/api/lnurlp/${encodeURIComponent(username)}/pay`, baseUrl).toString()
}

export function lnurlpVerifyUrl (username, hash, baseUrl = process.env.NEXT_PUBLIC_URL) {
  return new URL(`/api/lnurlp/${encodeURIComponent(username)}/verify/${encodeURIComponent(hash)}`, baseUrl).toString()
}

export async function sanitizeLud18PayerData (payerData) {
  const validated = await validateSchema(lud18PayerDataSchema, payerData)
  const sanitized = {}

  for (const key of ['name', 'pubkey', 'email', 'identifier']) {
    if (validated[key] != null) {
      sanitized[key] = validated[key]
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

// ===========================================================================
// SN as an LNURL client: paying someone else's lightning address
//
// Two entry points, each followed by the private helpers it uses:
//   fetchLnAddrService  — addr -> the provider's pay service (callback, limits)
//   fetchLnAddrInvoice  — addr -> a payable, amount-checked bolt11 invoice
// `service` throughout is the provider's lnurlp descriptor (LUD-06/16/18).
// ===========================================================================

// The LUD-18 payer-data fields SN can supply. pubkey is intentionally absent:
// the SN UI cannot satisfy it, and assertSupportedLnAddrPayerData rejects
// providers that mandate it before we ever build a payer payload.
export const SUPPORTED_PAYER_DATA_FIELDS = ['identifier', 'name', 'email']

// --- resolve an address to the provider's pay service ----------------------

export async function fetchLnAddrService (addr, { signal } = {}) {
  await lightningAddressValidator.required('required').validate(addr)
  const [name, domain] = addr.split('@')
  let protocol = 'https'
  if (process.env.NODE_ENV === 'development') {
    // support HTTP and HTTPS during development
    protocol = process.env.NEXT_PUBLIC_URL.split('://')[0]
  }

  let body
  const method = 'GET'
  // start as the base so a malformed domain still yields a useful error below
  let url = `${protocol}://${domain}`
  try {
    url = new URL(lnurlpWellKnownPath(name), url).toString()
    const res = await snFetch(url, { method, signal, timeout: WALLET_CREATE_INVOICE_TIMEOUT_MS })
    assertResponseOk(res, { method })
    assertContentTypeJson(res, { method })
    body = await res.json()
  } catch (err) {
    if (err instanceof ResponseAssertError || isAbortLike(err)) {
      throw err
    }
    if (err.name === 'SyntaxError') {
      throw new Error(`GET ${url}: invalid JSON`, { cause: err })
    }
    // Preserve the original error as `cause` so callers can distinguish DNS,
    // TLS, connection-refused, etc. instead of seeing one opaque message.
    throw new Error(`failed to fetch ${url}: ${err.message ?? err}`, { cause: err })
  }
  if (body.status === 'ERROR') {
    // Spec requires `reason` on ERROR responses; fall back to a generic
    // message that names the provider as the source rather than the user.
    throw new Error(body.reason ?? 'lightning address provider returned an error')
  }

  const { minSendable, maxSendable, ...leftOver } = body
  const limits = lnAddrSatsLimits({ minSendable, maxSendable })
  return { ...leftOver, addr, ...limits }
}

export function lnAddrSatsLimits ({ minSendable, maxSendable }) {
  // tolerate omitted/junk values: fall back to a 1 sat floor and no upper limit
  // rather than rejecting the address (Number()/Math.max can't clamp NaN)
  const minSats = Math.ceil(Number(minSendable) / 1000)
  const maxSats = maxSendable == null ? undefined : Math.floor(Number(maxSendable) / 1000)
  const min = Number.isFinite(minSats) ? Math.max(1, minSats) : 1
  const max = Number.isFinite(maxSats) ? maxSats : undefined

  if (!Number.isSafeInteger(min)) {
    throw new Error('lightning address returned invalid minimum amount')
  }
  if (max !== undefined && (!Number.isSafeInteger(max) || max < min)) {
    // a fixed-amount address (minSendable === maxSendable) that isn't a whole
    if (maxSendable != null && Number(minSendable) === Number(maxSendable)) {
      throw new Error('lightning address requires a sub-satoshi fixed amount, which is not supported')
    }
    throw new Error('lightning address returned invalid amount range')
  }

  return {
    min,
    ...(max !== undefined ? { max } : {})
  }
}

// --- resolve an address to a payable bolt11 invoice ------------------------

export async function fetchLnAddrInvoice (
  { addr, amount, comment, ...payerValues },
  { me, service, signal, validateInvoice = assertBolt11Msats } = {}
) {
  // reuse a service the caller already resolved for this address, else fetch it
  service = service?.callback && service.addr === addr ? service : await fetchLnAddrService(addr, { signal })
  assertSupportedLnAddrPayerData(service)
  await validateSchema(lnAddrSchema, { addr, amount, comment, ...payerValues }, service)

  const msats = satsToMsats(Number(amount))
  const payer = buildLnAddrPayerData(payerValues, service, me)
  const callback = lnAddrInvoiceUrl(service, { msats, comment, payer })
  const body = await fetchInvoiceFromCallback(callback, { signal })

  if (!body.pr) {
    throw new Error('lightning address did not return a bolt11 invoice')
  }

  // Normalize BOLT11 casing once before downstream payment validation and sends.
  const pr = body.pr.toLowerCase()
  // Enforce that the returned invoice matches the requested amount; callers can
  // pass `validateInvoice: null` to opt out.
  if (validateInvoice) await validateInvoice(pr, msats)

  return { ...body, pr }
}

export function assertSupportedLnAddrPayerData (service) {
  if (service?.payerData?.pubkey?.mandatory) {
    throw new Error('lightning address requires payer pubkey, which SN does not support')
  }
}

function buildLnAddrPayerData (values, service, me) {
  const payer = {}
  for (const key of SUPPORTED_PAYER_DATA_FIELDS) {
    const spec = service.payerData?.[key]
    if (!spec) continue
    const value = key === 'identifier'
      ? (values.identifier ? `${me.name}@stacker.news` : null)
      : values[key]
    if (value) payer[key] = value
    else if (spec.mandatory) throw new Error(`${key} is required`)
  }
  return payer
}

export function lnAddrInvoiceUrl (service, { msats, comment, payer }) {
  const callback = new URL(service.callback)
  callback.searchParams.set('amount', msats)

  if (comment) {
    callback.searchParams.set('comment', comment)
  }

  if (Object.keys(payer || {}).length > 0) {
    callback.searchParams.set('payerdata', JSON.stringify(payer))
  }

  return callback
}

export async function fetchInvoiceFromCallback (url, { signal } = {}) {
  const method = 'GET'
  const res = await snFetch(url.toString(), { method, signal, timeout: WALLET_CREATE_INVOICE_TIMEOUT_MS })
  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const body = await res.json()
  if (body.status === 'ERROR') {
    throw new Error(body.reason ?? 'lightning address failed')
  }

  return body
}

// --- form helpers (consumed by the send UI, not the pipeline) --------------

// Which payer fields the LN-address send form renders, split into mandatory and
// optional, derived from the provider's service. Mandatory keeps SUPPORTED
// order; optional keeps the form's historical order (comment first).
export function lnAddrFormFields ({ payerData, commentAllowed } = {}) {
  const mandatory = SUPPORTED_PAYER_DATA_FIELDS.filter(key => payerData?.[key]?.mandatory)
  const optional = [
    commentAllowed ? 'comment' : null,
    ...['name', 'email', 'identifier'].filter(key => payerData?.[key] && !payerData[key].mandatory)
  ].filter(Boolean)
  return { mandatory, optional }
}
