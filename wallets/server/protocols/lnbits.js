import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { lnbitsPaymentCheckResult, lnbitsRequest } from '@/wallets/lib/lnbits'

export const name = 'LNBITS'
// lnbits only invoices whole sats, so it can receive a request snapped down to the sat grid
export const receivableMsats = msatsSatsFloor

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, apiKey },
  { signal }) {
  // lnbits doesn't support msats so we have to floor to nearest sat
  const sats = msatsToSats(msats)

  const body = JSON.stringify({
    amount: sats,
    unit: 'sat',
    expiry,
    memo: description,
    out: false
  })

  const { baseUrl, protocol } = lnbitsBaseUrl(url)
  const payment = await lnbitsRequest({
    url: baseUrl,
    protocol,
    apiKey,
    path: '/api/v1/payments',
    method: 'POST',
    body,
    signal,
    timeout: WALLET_CREATE_INVOICE_TIMEOUT_MS
  })

  return payment?.payment_request || payment?.bolt11
}

export async function checkInvoice ({ hash }, { url, apiKey }, { signal }) {
  const { baseUrl, protocol } = lnbitsBaseUrl(url)
  const payment = await lnbitsRequest({
    url: baseUrl,
    protocol,
    apiKey,
    path: `/api/v1/payments/${hash}`,
    signal,
    notFoundOk: true
  })
  return lnbitsPaymentCheckResult(payment, { failedError: 'lnbits invoice failed' })
}

function lnbitsBaseUrl (url) {
  let baseUrl = url
  let protocol
  if (process.env.NODE_ENV !== 'production') {
    // to make it possible to attach LNbits for receives during local dev
    const hostname = baseUrl.replace(/^https?:\/\//, '').split(/[:/]/)[0]
    if (hostname === 'localhost') {
      const port = baseUrl.match(/:(\d+)/)?.[1]
      baseUrl = port === process.env.LNBITS_WEB_PORT ? 'lnbits:5000' : 'lnbits-v1:5000'
      // Docker LNbits containers run HTTP on port 5000
      protocol = 'http'
    }
  }
  return { baseUrl, protocol }
}

export async function testCreateInvoice ({ url, apiKey }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url, apiKey },
    { signal }
  )
}
