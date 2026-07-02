import { BLINK_TX_ALREADY_PAID, BLINK_TX_FAILURE, BLINK_TX_PENDING, BLINK_TX_SUCCESS, blinkTransactionCheckResult, getScopes, getTransactionByPaymentHash, SCOPE_READ, SCOPE_WRITE, getWallet, normalizeBlinkCurrency, request } from '@/wallets/lib/protocols/blink'
import { WalletPaymentRejectedError, WalletPermissionsError } from '@/wallets/client/errors'
import { abortableSleep } from '@/lib/time'
import { walletBalance, pollPaymentCheckUntilSettled } from './util'
import { bolt11ToPayment } from '@/lib/bolt11'

export const name = 'BLINK'
// Blink's lnInvoicePaymentSend does not expose a per-call fee cap.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { apiKey, currency }, { signal }) {
  currency = normalizeBlinkCurrency(currency)
  const wallet = await getWallet({ apiKey, currency }, { signal })
  return await payInvoice(bolt11, { apiKey, wallet, paymentHash: bolt11ToPayment(bolt11).hash }, { signal })
}

export async function testSendPayment ({ apiKey, currency }, { signal }) {
  const scopes = await getScopes({ apiKey }, { signal })
  if (!scopes.includes(SCOPE_READ)) {
    throw new WalletPermissionsError('missing READ scope')
  }
  if (!scopes.includes(SCOPE_WRITE)) {
    throw new WalletPermissionsError('missing WRITE scope')
  }

  currency = normalizeBlinkCurrency(currency)
  await getWallet({ apiKey, currency }, { signal })
}

export async function getBalance ({ apiKey, currency }, { signal } = {}) {
  currency = normalizeBlinkCurrency(currency)
  const wallet = await getWallet({ apiKey, currency }, { signal })
  // Blink returns wallet.balance in the minor unit for the selected wallet currency.
  // Its ledger can report a negative balance in production; clamp to zero instead of
  // letting toPositiveNumber throw and break balance display.
  return walletBalance(wallet.balance == null ? null : Math.max(0, Number(wallet.balance)), currency)
}

export async function checkPayment ({ hash }, { apiKey }, { signal }) {
  // no wallet: the lookup searches every wallet in one request, so the reconciler's
  // periodic check never pays a wallet-id-resolving round trip
  return await checkBlinkPayment(hash, { apiKey }, { signal })
}

async function checkBlinkPayment (hash, { apiKey, wallet }, { signal }) {
  return blinkTransactionCheckResult(
    await getTransactionByPaymentHash(hash, { apiKey, wallet, direction: 'SEND' }, { signal }),
    { failureError: 'failed to pay invoice' }
  )
}

async function payInvoice (bolt11, { apiKey, wallet, paymentHash }, { signal }) {
  const out = await request({
    apiKey,
    query: `
      mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
        lnInvoicePaymentSend(input: $input) {
          status
          errors {
            message
            path
            code
          }
          transaction {
            settlementFee
            settlementCurrency
            createdAt
            settlementVia {
              ... on SettlementViaIntraLedger {
                preImage
              }
              ... on SettlementViaLn {
                preImage
              }
            }
          }
        }
      }`,
    variables: {
      input: {
        paymentRequest: bolt11,
        walletId: wallet.id
      }
    }
  }, { signal })

  const status = out.data.lnInvoicePaymentSend.status
  const errors = out.data.lnInvoicePaymentSend.errors

  const waitForSettledPayment = async () => {
    // preserve the original sleep-before-first-probe timing
    await abortableSleep(100, signal)
    return await pollPaymentCheckUntilSettled(
      () => checkBlinkPayment(paymentHash, { apiKey, wallet }, { signal }),
      { intervalMs: 100, signal }
    )
  }

  // Blink FAILURE can be pre-flight, in-flight, or post-settlement; corroborate.
  if ((errors && errors.length > 0) || status === BLINK_TX_FAILURE) {
    const rejection = new WalletPaymentRejectedError(
      errors && errors.length > 0
        ? 'failed to pay invoice ' + errors.map(e => e.code + ' ' + e.message).join(', ')
        : 'failed to pay invoice')
    const tx = await getTransactionByPaymentHash(paymentHash, { apiKey, wallet, direction: 'SEND' }, { signal })
    if (!tx) throw rejection
    const check = blinkTransactionCheckResult(tx, { failureError: rejection.message })
    if (check.status === 'SETTLED') return check
    if (check.status === 'FAILED') throw rejection
    return await waitForSettledPayment()
  }

  if (status === BLINK_TX_SUCCESS) {
    // payment was settled immediately. A missing preimage is unknown, not a
    // failure: return it and let the external transaction classifier record that.
    const transaction = out.data.lnInvoicePaymentSend.transaction
    return blinkTransactionCheckResult({
      status: BLINK_TX_SUCCESS,
      preImage: transaction?.settlementVia?.preImage,
      settlementFee: transaction?.settlementFee,
      settlementCurrency: transaction?.settlementCurrency,
      createdAt: transaction?.createdAt
    })
  }

  if (status === BLINK_TX_PENDING || status === BLINK_TX_ALREADY_PAID) {
    // payment couldn't be settled (or fail) immediately, so we wait for a result
    return await waitForSettledPayment()
  }

  // this should never happen
  throw new Error('unexpected error')
}
