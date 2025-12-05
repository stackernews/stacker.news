import { getScopes, SCOPE_READ, SCOPE_RECEIVE, SCOPE_WRITE, getWallet, request } from '@/wallets/lib/protocols/blink'
import { msatsToSats } from '@/lib/format'

export const name = 'BLINK'

export async function createInvoice (
  { msats, description, expiry },
  { apiKeyRecv: apiKey, currencyRecv: currency },
  { signal }) {
  currency = currency ? currency.toUpperCase() : 'BTC'

  const wallet = await getWallet({ apiKey, currency }, { signal })

  if (currency !== 'BTC') {
    throw new Error('unsupported currency ' + currency)
  }

  const out = await request({
    apiKey,
    query: `
      mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice {
            paymentRequest
          }
          errors {
            message
          }
        }
      }`,
    variables: {
      input: {
        amount: msatsToSats(msats),
        expiresIn: Math.floor(expiry / 60) || 1,
        memo: description,
        walletId: wallet.id
      }
    }
  }, { signal })

  const res = out.data.lnInvoiceCreate
  const errors = res.errors
  if (errors && errors.length > 0) {
    throw new Error(errors.map(e => e.code + ' ' + e.message).join(', '))
  }

  return res.invoice.paymentRequest
}

export async function testCreateInvoice ({ apiKeyRecv, currencyRecv }, { signal }) {
  const scopes = await getScopes({ apiKey: apiKeyRecv }, { signal })
  if (!scopes.includes(SCOPE_READ)) {
    throw new Error('missing READ scope')
  }
  if (scopes.includes(SCOPE_WRITE)) {
    throw new Error('WRITE scope must not be present')
  }
  if (!scopes.includes(SCOPE_RECEIVE)) {
    throw new Error('missing RECEIVE scope')
  }

  currencyRecv = currencyRecv ? currencyRecv.toUpperCase() : 'BTC'
  return await createInvoice({ msats: 1000, expiry: 1 }, { apiKeyRecv, currencyRecv }, { signal })
}
