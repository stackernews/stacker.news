import { getScopes, SCOPE_READ, SCOPE_WRITE, getWallet, request } from '@/wallets/lib/protocols/blink'

export const name = 'BLINK'

export async function sendPayment (bolt11, { apiKey, currency }, { signal }) {
  const wallet = await getWallet({ apiKey, currency }, { signal })
  return await payInvoice(bolt11, { apiKey, wallet }, { signal })
}

export async function testSendPayment ({ apiKey, currency }, { signal }) {
  const scopes = await getScopes({ apiKey }, { signal })
  if (!scopes.includes(SCOPE_READ)) {
    throw new Error('missing READ scope')
  }
  if (!scopes.includes(SCOPE_WRITE)) {
    throw new Error('missing WRITE scope')
  }

  currency = currency ? currency.toUpperCase() : 'BTC'
  await getWallet({ apiKey, currency }, { signal })
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
    throw new Error('failed to pay invoice ' + errors.map(e => e.code + ' ' + e.message).join(', '))
  }

  // payment was settled immediately
  if (status === 'SUCCESS') {
    const preimage = out.data.lnInvoicePaymentSend.transaction.settlementVia.preImage
    if (!preimage) throw new Error('no preimage')
    return preimage
  }

  // payment failed immediately
  if (status === 'FAILED') {
    throw new Error('failed to pay invoice')
  }

  // payment couldn't be settled (or fail) immediately, so we wait for a result
  if (status === 'PENDING') {
    while (true) {
      // at some point it should either be settled or fail on the backend, so the loop will exit
      await new Promise(resolve => setTimeout(resolve, 100))

      const txInfo = await getTxInfo(bolt11, { apiKey, wallet }, { signal })
      // settled
      if (txInfo.status === 'SUCCESS') {
        if (!txInfo.preImage) throw new Error('no preimage')
        return txInfo.preImage
      }
      // failed
      if (txInfo.status === 'FAILED') {
        throw new Error(txInfo.error || 'failed to pay invoice')
      }
      // still pending
      // retry later
    }
  }

  // this should never happen
  throw new Error('unexpected error')
}

async function getTxInfo (bolt11, { apiKey, wallet }, { signal }) {
  let out
  try {
    out = await request({
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
        walletId: wallet.Id
      }
    }, { signal })
  } catch (e) {
    // something went wrong during the query,
    // maybe the connection was lost, so we just return
    // a pending status, the caller can retry later
    return {
      status: 'PENDING',
      preImage: null,
      error: ''
    }
  }
  const tx = out.data.me.defaultAccount.walletById.transactionsByPaymentRequest.find(t => t.direction === 'SEND')
  if (!tx) {
    // the transaction was not found, something went wrong
    return {
      status: 'FAILED',
      preImage: null,
      error: 'transaction not found'
    }
  }
  const status = tx.status
  const preImage = tx.settlementVia.preImage
  return {
    status,
    preImage,
    error: ''
  }
}
