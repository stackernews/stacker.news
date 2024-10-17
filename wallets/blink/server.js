import { withTimeout } from '@/lib/time'
import { getScopes, SCOPE_READ, SCOPE_RECEIVE, SCOPE_WRITE, getWallet, request } from 'wallets/blink/common'
import { msatsToSats } from '@/lib/format'
export * from 'wallets/blink'

export async function testCreateInvoice ({ apiKeyRecv, currencyRecv }) {
  const strict = true
  const scopes = await getScopes(apiKeyRecv)
  if (!scopes.includes(SCOPE_READ)) {
    throw new Error('missing READ scope')
  }
  if (strict && scopes.includes(SCOPE_WRITE)) {
    throw new Error('WRITE scope must not be present')
  }
  if (!scopes.includes(SCOPE_RECEIVE)) {
    throw new Error('missing RECEIVE scope')
  }

  const timeout = 15_000
  currencyRecv = currencyRecv ? currencyRecv.toUpperCase() : 'BTC'
  return await withTimeout(createInvoice({ msats: 1000, expiry: 1 }, { apiKeyRecv, currencyRecv }), timeout)
}

export async function createInvoice (
  { msats, description, expiry },
  { apiKeyRecv, currencyRecv }) {
  currencyRecv = currencyRecv ? currencyRecv.toUpperCase() : 'BTC'

  const wallet = await getWallet(apiKeyRecv, currencyRecv)

  if (currencyRecv !== 'BTC') {
    throw new Error('unsupported currency ' + currencyRecv)
  }
  const mutation = `
        mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
            lnInvoiceCreate(input: $input) {
                invoice {
                    paymentRequest
                }
                errors {
                    message
                }
            }
        }
    `

  const out = await request(apiKeyRecv, mutation, {
    input: {
      amount: msatsToSats(msats),
      expiresIn: Math.floor(expiry / 60) || 1,
      memo: description,
      walletId: wallet.id
    }
  })
  const res = out.data.lnInvoiceCreate
  const errors = res.errors
  if (errors && errors.length > 0) {
    throw new Error('failed to pay invoice ' + errors.map(e => e.code + ' ' + e.message).join(', '))
  }
  const invoice = res.invoice.paymentRequest
  return invoice
}
