import { blinkTransactionCheckResult, getInvoiceStatusByPaymentHash, getScopes, getTransactionByPaymentHash, SCOPE_READ, SCOPE_RECEIVE, SCOPE_WRITE, getWallet, normalizeBlinkCurrency, request } from '@/wallets/lib/protocols/blink'
import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { WalletPermissionsError } from '@/wallets/client/errors'

export const name = 'BLINK'
// Blink (BTC) only invoices whole sats, so it can receive a request snapped down to the sat grid
export const receivableMsats = msatsSatsFloor

export async function createInvoice (
  { msats, description, expiry },
  { apiKey, currency },
  { signal }) {
  currency = normalizeBlinkCurrency(currency)
  if (currency !== 'BTC') {
    throw new Error('unsupported currency ' + currency)
  }

  const wallet = await getWallet({ apiKey, currency }, { signal })

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
    throw new Error(errors.map(e => e.message).join(', '))
  }

  return res.invoice.paymentRequest
}

export async function checkInvoice ({ hash }, { apiKey, currency }, { signal }) {
  currency = normalizeBlinkCurrency(currency)
  const wallet = await getWallet({ apiKey, currency }, { signal })
  const tx = await getTransactionByPaymentHash(hash, { apiKey, wallet, direction: 'RECEIVE' }, { signal })

  const result = blinkTransactionCheckResult(tx, { failureError: 'blink invoice failed' })
  if (result.status !== 'PENDING') return result

  const invoiceStatus = await getInvoiceStatusByPaymentHash(hash, { apiKey, wallet }, { signal })
  if (invoiceStatus === 'EXPIRED') {
    return { status: 'FAILED', error: 'invoice expired' }
  }
  return result
}

export async function testCreateInvoice ({ apiKey, currency }, { signal }) {
  const scopes = await getScopes({ apiKey }, { signal })
  if (!scopes.includes(SCOPE_READ)) {
    throw new WalletPermissionsError('missing READ scope')
  }
  if (scopes.includes(SCOPE_WRITE)) {
    throw new WalletPermissionsError('WRITE scope must not be present')
  }
  if (!scopes.includes(SCOPE_RECEIVE)) {
    throw new WalletPermissionsError('missing RECEIVE scope')
  }

  return await createInvoice({ msats: 1000, expiry: 1 }, { apiKey, currency }, { signal })
}
