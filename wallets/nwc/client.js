import { withTimeout } from '@/lib/time'
import { nwcCall, supportedMethods } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function testSendPayment ({ nwcUrl }, { logger }) {
  const timeout = 15_000

  const supported = await withTimeout(supportedMethods(nwcUrl, { logger }), timeout)
  if (!supported.includes('pay_invoice')) {
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
