import { callApi } from '@/wallets/phoenixd'

export * from '@/wallets/phoenixd'

export async function testSendPayment (config, { logger }) {
  // TODO:
  //   Not sure which endpoint to call to test primary password
  //   see https://phoenix.acinq.co/server/api
  //   Maybe just wait until test payments with HODL invoices?

}

export async function sendPayment (bolt11, { url, primaryPassword }) {
  // https://phoenix.acinq.co/server/api#pay-bolt11-invoice
  const payment = await callApi(
    'payinvoice',
    { invoice: bolt11 },
    { url, password: primaryPassword }
  )
  const preimage = payment.paymentPreimage
  if (!preimage) {
    throw new Error(payment.reason)
  }

  return preimage
}

export async function getBalance ({ url, primaryPassword }) {
  // https://phoenix.acinq.co/server/api#get-balance
  const result = await callApi(
    'getbalance',
    {},
    {
      url,
      password: primaryPassword,
      method: 'GET'
    })
  return BigInt(result.balanceSat * 1000)
}
