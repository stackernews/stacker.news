import { withTimeout } from '@/lib/time'
import { hasMethod, nwcCall } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function testSendPayment ({ nwcUrl }, { logger }) {
  const timeout = 15_000

  const supported = await withTimeout(hasMethod(nwcUrl, 'pay_invoice', { logger }), timeout)
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
