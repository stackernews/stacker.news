import { galoyBlinkUrl } from 'wallets/blink'
export * from 'wallets/blink'

export async function testConnectClient ({ apiKey, currency }, { logger }) {
  currency = currency ? currency.toUpperCase() : 'BTC'
  logger.info('trying to fetch wallet')
  await getWallet(apiKey, currency)
  logger.ok('wallet found')
}

export async function sendPayment (bolt11, { apiKey, currency }) {
  currency = currency ? currency.toUpperCase() : 'BTC'
  const wallet = await getWallet(apiKey, currency)
  const preimage = await payInvoice(apiKey, wallet, bolt11)
  return { preimage }
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
        `, {
    input: {
      paymentRequest: invoice,
      walletId
    }
  })
  const status = out.data.lnInvoicePaymentSend.status
  const errors = out.data.lnInvoicePaymentSend.errors
  if (errors && errors.length > 0) throw new Error('failed to pay invoice ' + errors.map(e => e.code + ' ' + e.message).join(', '))
  if (status !== 'SUCCESS') throw new Error('failed to pay invoice ' + status)
  const preimage = out.data.lnInvoicePaymentSend.transaction.settlementVia.preImage
  if (!preimage) throw new Error('no preimage')
  return preimage
}

async function getWallet (authToken, currency = 'BTC') {
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
  return fetch(galoyBlinkUrl, options).then(response => response.json())
}
