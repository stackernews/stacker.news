import { supportedMethods, nwcTryRun } from '@/wallets/lib/protocols/nwc'

export const name = 'NWC'

export async function sendPayment (bolt11, { url }, { signal }) {
  const result = await nwcTryRun(nwc => nwc.lnPay({ pr: bolt11 }), { url }, { signal })
  return result.preimage
}

export async function testSendPayment ({ url }, { signal }) {
  const supported = await supportedMethods(url, { signal })
  if (!supported.includes('pay_invoice')) {
    throw new Error('pay_invoice not supported')
  }
}
