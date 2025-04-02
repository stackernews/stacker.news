import { supportedMethods, nwcTryRun } from '@/wallets/nwc'
export * from '@/wallets/nwc'

export async function testSendPayment ({ nwcUrl }, { signal }) {
  const supported = await supportedMethods(nwcUrl, { signal })
  if (!supported.includes('pay_invoice')) {
    throw new Error('pay_invoice not supported')
  }
}

export async function sendPayment (bolt11, { nwcUrl }, { signal }) {
  const result = await nwcTryRun(nwc => nwc.lnPay({ pr: bolt11 }), { nwcUrl }, { signal })
  return result.preimage
}
