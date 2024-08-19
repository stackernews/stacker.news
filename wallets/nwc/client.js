import { hasMethod, nwcCall } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function testSendPayment ({ nwcUrl }, { logger }) {
  const supported = await hasMethod(nwcUrl, 'pay_invoice', { logger })
  if (!supported) {
    throw new Error('pay_invoice not supported')
  }
}

export async function sendPayment (bolt11, { nwcUrl }, { logger }) {
  const result = await nwcCall({
    nwcUrl,
    method: 'pay_invoice',
    params: { invoice: bolt11 }
  },
  { logger })
  return result.preimage
}
