import { nwcCall } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function sendPayment (bolt11, { nwcUrl }, { logger }) {
  const result = await nwcCall({
    nwcUrl,
    method: 'pay_invoice',
    params: { invoice: bolt11 }
  },
  { logger })
  return result.preimage
}
