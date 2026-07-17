import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { lnbitsRequest, lnbitsSettlementEvidence } from '@/wallets/lib/protocols/lnbits'

export const name = 'LNBITS'
// lnbits only invoices whole sats, so it can receive a request snapped down to the sat grid
export const receivableMsats = msatsSatsFloor

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, apiKey },
  { signal }) {
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

export async function checkInvoice ({ hash, invoiceExpiresAt }, { url, apiKey }, { signal }) {
  const { baseUrl, protocol } = lnbitsBaseUrl(url)
  const payment = await lnbitsRequest({
    url: baseUrl,
    protocol,
    apiKey,
    path: `/api/v1/payments/${hash}`,
    signal,
    notFoundOk: true
  })
  if (payment?.paid === true) {
    return {
      status: 'SETTLED',
      ...lnbitsSettlementEvidence(payment),
      msats: payment.details?.amount
    }
  }
  // LNbits uses the generic FAILED status for expired and canceled invoices.
  // The status is nested under details in current releases and top-level in
  // older responses.
  if ((payment?.details?.status ?? payment?.status) === 'failed') {
    if (new Date(invoiceExpiresAt) <= new Date()) {
      return { status: 'EXPIRED' }
    }
    return {
      status: 'FAILED',
      detail: 'lnbits invoice failed'
    }
  }
  return { status: 'PENDING' }
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
