export * from '@/wallets/phoenixd'

export async function testSendPayment (config, { logger }) {
  // TODO:
  //   Not sure which endpoint to call to test primary password
  //   see https://phoenix.acinq.co/server/api
  //   Maybe just wait until test payments with HODL invoices?

}

export async function sendPayment (bolt11, { url, primaryPassword }) {
  // https://phoenix.acinq.co/server/api#pay-bolt11-invoice
  const path = '/payinvoice'

  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + primaryPassword).toString('base64'))
  headers.set('Content-type', 'application/x-www-form-urlencoded')

  const body = new URLSearchParams()
  body.append('invoice', bolt11)

  const res = await fetch(url + path, {
    method: 'POST',
    headers,
    body
  })
  if (!res.ok) {
    throw new Error(`POST ${res.url}: ${res.status} ${res.statusText}`)
  }

  const payment = await res.json()
  const preimage = payment.paymentPreimage
  if (!preimage) {
    throw new Error(payment.reason)
  }

  return preimage
}
