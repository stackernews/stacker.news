import { blinkErrorsMessage, blinkTransactionCheckResult, getInvoiceStatusByPaymentHash, getScopes, getTransactionByPaymentHash, SCOPE_READ, SCOPE_RECEIVE, SCOPE_WRITE, getWallet, normalizeBlinkCurrency, request } from '@/wallets/lib/protocols/blink'
import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { WalletPermissionsError } from '@/wallets/lib/errors'

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

  const res = out?.data?.lnInvoiceCreate
  if (!res) {
    throw new Error(blinkErrorsMessage(out?.errors, 'blink invoice creation failed'))
  }
  const errors = res.errors
  if (errors && errors.length > 0) {
    throw new Error(blinkErrorsMessage(errors, 'blink invoice creation failed'))
  }

  return res.invoice.paymentRequest
}

export async function checkInvoice ({ hash, invoiceExpiresAt }, { apiKey, currency }, { signal }) {
  currency = normalizeBlinkCurrency(currency)
  const { transaction: tx, wallet } = await getTransactionByPaymentHash(
    hash,
    { apiKey, currency, direction: 'RECEIVE' },
    { signal }
  )

  let result = blinkTransactionCheckResult(tx)
  // a FAILURE ledger entry on a receive is a failed *attempt*, not the invoice's
  // fate — only the EXPIRED probe below can establish that the invoice is unpaid.
  if (result.status === 'FAILED') result = { status: 'PENDING' }
  if (result.status !== 'PENDING') return result

  // Blink can only report EXPIRED after expiry, so query it only once that's possible.
  if (new Date(invoiceExpiresAt) > new Date()) return result

  if (!wallet) throw new Error(`wallet ${currency} not found`)
  const invoiceStatus = await getInvoiceStatusByPaymentHash(hash, { apiKey, wallet }, { signal })
  if (invoiceStatus === 'PAID') return { status: 'SETTLED' }
  if (invoiceStatus === 'EXPIRED') return { status: 'EXPIRED' }
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
