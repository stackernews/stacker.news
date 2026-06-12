import { getScopes, SCOPE_READ, SCOPE_WRITE, getWallet, request } from '@/wallets/lib/protocols/blink'
import { WalletPaymentRejectedError, WalletPermissionsError } from '@/wallets/client/errors'
import { abortableSleep } from '@/lib/time'
import { walletBalance, pollUntilSettled } from './util'

export const name = 'BLINK'
// Blink's lnInvoicePaymentSend does not expose a per-call fee cap.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { apiKey, currency }, { signal }) {
  const wallet = await getWallet({ apiKey, currency }, { signal })
  return await payInvoice(bolt11, { apiKey, wallet }, { signal })
}

export async function testSendPayment ({ apiKey, currency }, { signal }) {
  const scopes = await getScopes({ apiKey }, { signal })
  if (!scopes.includes(SCOPE_READ)) {
    throw new WalletPermissionsError('missing READ scope')
  }
  if (!scopes.includes(SCOPE_WRITE)) {
    throw new WalletPermissionsError('missing WRITE scope')
  }

  currency = currency ? currency.toUpperCase() : 'BTC'
  await getWallet({ apiKey, currency }, { signal })
}

export async function getBalance ({ apiKey, currency }, { signal } = {}) {
  currency = currency ? currency.toUpperCase() : 'BTC'
  const wallet = await getWallet({ apiKey, currency }, { signal })
  // Blink returns wallet.balance in the minor unit for the selected wallet currency.
  return walletBalance(wallet.balance, currency)
}

async function payInvoice (bolt11, { apiKey, wallet }, { signal }) {
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
  if (errors && errors.length > 0) {
    throw new WalletPaymentRejectedError('failed to pay invoice ' + errors.map(e => e.code + ' ' + e.message).join(', '))
  }

  // payment was settled immediately. A missing preimage is settled-unknown, not a
  // failure: return it and let sendWalletPayment flag it via the proof check.
  if (status === 'SUCCESS') {
    return out.data.lnInvoicePaymentSend.transaction.settlementVia.preImage
  }

  // payment failed immediately
  if (status === 'FAILED') {
    throw new WalletPaymentRejectedError('failed to pay invoice')
  }

  // payment couldn't be settled (or fail) immediately, so we wait for a result
  if (status === 'PENDING') {
    // preserve the original sleep-before-first-probe timing
    await abortableSleep(100, signal)
    return await pollUntilSettled(
      () => getTxInfo(bolt11, { apiKey, wallet }, { signal }),
      // a SUCCESS without preImage is settled-unknown: return it and let
      // sendWalletPayment flag it via the proof check (like clink/lnbits)
      tx => tx?.status === 'SUCCESS'
        ? { value: tx.preImage }
        : tx?.status === 'FAILED'
          ? { error: tx.error || 'failed to pay invoice' }
          : null,
      { intervalMs: 100, signal }
    )
  }

  // this should never happen
  throw new Error('unexpected error')
}

// Reads the SEND transaction's status; throws on read failure for the caller's poll loop to classify.
async function getTxInfo (bolt11, { apiKey, wallet }, { signal }) {
  const out = await request({
    apiKey,
    query: `
      query GetTxInfo($walletId: WalletId!, $paymentRequest: LnPaymentRequest!) {
        me {
          defaultAccount {
            walletById(walletId: $walletId) {
              transactionsByPaymentRequest(paymentRequest: $paymentRequest) {
                status
                direction
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
          }
        }
      }`,
    variables: {
      paymentRequest: bolt11,
      walletId: wallet.id
    }
  }, { signal })

  const tx = out.data.me.defaultAccount.walletById.transactionsByPaymentRequest.find(t => t.direction === 'SEND')
  if (!tx) {
    // not yet indexed: transactionsByPaymentRequest is eventually consistent right
    // after submit, so report still-pending rather than fabricating a failure for
    // an in-flight payment. If it never appears, the caller's timeout classifies
    // the send as settled-unknown.
    return null
  }
  return {
    status: tx.status,
    preImage: tx.settlementVia?.preImage,
    error: ''
  }
}
