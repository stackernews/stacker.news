import { galoyBlinkUrl } from 'wallets/blink'
export * from 'wallets/blink'

export async function testSendPayment ({ apiKey, currency }, { logger }) {
  currency = currency ? currency.toUpperCase() : 'BTC'
  logger.info('trying to fetch ' + currency + ' wallet')
  await getWallet(apiKey, currency)
  logger.ok(currency + ' wallet found')
}

export async function sendPayment (bolt11, { apiKey, currency }) {
  const wallet = await getWallet(apiKey, currency)
  return await payInvoice(apiKey, wallet, bolt11)
}

async function payInvoice (authToken, wallet, invoice) {
  const walletId = wallet.id
  const out = await request(authToken, `
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
    }
  `,
  {
    input: {
      paymentRequest: invoice,
      walletId
    }
  })
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

      const txInfo = await getTxInfo(authToken, wallet, invoice)
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

async function getTxInfo (authToken, wallet, invoice) {
  const walletId = wallet.id
  let out
  try {
    out = await request(authToken, `
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
      }
    `,
    {
      paymentRequest: invoice,
      walletId
    })
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

async function getWallet (authToken, currency) {
  const out = await request(authToken, `
    query me {
        me {
            defaultAccount {
                wallets {
                    id
                    walletCurrency
                }
            }
        }
    }
  `, {})
  const wallets = out.data.me.defaultAccount.wallets
  for (const wallet of wallets) {
    if (wallet.walletCurrency === currency) {
      return wallet
    }
  }
  throw new Error(`wallet ${currency} not found`)
}

async function request (authToken, query, variables = {}) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': authToken
    },
    body: JSON.stringify({ query, variables })
  }
  const res = await fetch(galoyBlinkUrl, options)
  if (res.status >= 400 && res.status <= 599) {
    if (res.status === 401) {
      throw new Error('unauthorized')
    } else {
      throw new Error('API responded with HTTP ' + res.status)
    }
  }
  return res.json()
}
