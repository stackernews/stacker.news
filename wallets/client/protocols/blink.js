import { blinkErrorsMessage, BLINK_TX_ALREADY_PAID, BLINK_TX_FAILURE, BLINK_TX_PENDING, BLINK_TX_SUCCESS, blinkTransactionCheckResult, getScopes, getTransactionByPaymentHash, SCOPE_READ, SCOPE_WRITE, getWallet, normalizeBlinkCurrency, request } from '@/wallets/lib/protocols/blink'
import { WalletPaymentRejectedError, WalletPermissionsError } from '@/wallets/client/errors'
import { walletBalance } from './util'
import { bolt11ToPayment } from '@/lib/bolt11'

export const name = 'BLINK'
// Blink's lnInvoicePaymentSend does not expose a per-call fee cap.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { apiKey, currency }, { signal }) {
  currency = normalizeBlinkCurrency(currency)
  const wallet = await getWallet({ apiKey, currency }, { signal })
  const out = await request({
    apiKey,
    query: `
      mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
        lnInvoicePaymentSend(input: $input) {
          status
          errors {
            message
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

  // Blink can answer 200 with data: null plus a top-level error
  const payload = out?.data?.lnInvoicePaymentSend
  if (!payload) {
    throw new Error(blinkErrorsMessage(out?.errors, 'blink payment mutation failed'))
  }
  const { status, errors } = payload
  const hasErrors = errors?.length > 0

  // Blink FAILURE can be pre-flight, in-flight, or post-settlement; corroborate.
  if (hasErrors || status === BLINK_TX_FAILURE) {
    const rejection = new WalletPaymentRejectedError(
      hasErrors
        ? 'failed to pay invoice ' + errors.map(e => e.code + ' ' + e.message).join(', ')
        : 'failed to pay invoice')
    // A failed lookup proves nothing; never convert its error into a payment rejection.
    const tx = await lookupOutgoingTransaction(bolt11ToPayment(bolt11).hash, apiKey, signal)
    if (!tx) {
      if (hasErrors) throw rejection
      throw new Error('blink reported failure but has no record of the payment yet')
    }
    const check = blinkTransactionCheckResult(tx, { failureError: rejection.message })
    if (check.status === 'FAILED') throw rejection
    return check
  }

  if (status === BLINK_TX_SUCCESS) {
    // payment was settled immediately. A missing preimage is unknown, not a
    // failure: return it and let the external transaction classifier record that.
    return blinkTransactionCheckResult({
      ...payload.transaction,
      status,
      preImage: payload.transaction?.settlementVia?.preImage
    })
  }

  if ([BLINK_TX_PENDING, BLINK_TX_ALREADY_PAID].includes(status)) {
    return { status: 'PENDING' }
  }

  // this should never happen
  throw new Error('unexpected error')
}

export async function testSendPayment ({ apiKey, currency }, { signal }) {
  const scopes = await getScopes({ apiKey }, { signal })
  const missingScope = [SCOPE_READ, SCOPE_WRITE].find(scope => !scopes.includes(scope))
  if (missingScope) throw new WalletPermissionsError(`missing ${missingScope} scope`)

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
  const tx = await lookupOutgoingTransaction(hash, apiKey, signal)
  return blinkTransactionCheckResult(tx, { failureError: 'failed to pay invoice' })
}

async function lookupOutgoingTransaction (hash, apiKey, signal) {
  const { transaction } = await getTransactionByPaymentHash(
    hash,
    { apiKey, direction: 'SEND' },
    { signal }
  )
  return transaction
}
