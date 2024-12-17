import { getNwc, supportedMethods, nwcTryRun } from '@/wallets/nwc'
export * from '@/wallets/nwc'

export async function testSendPayment ({ nwcUrl }, { signal }) {
  const supported = await supportedMethods(nwcUrl, { signal })
  if (!supported.includes('pay_invoice')) {
    throw new Error('pay_invoice not supported')
  }
}

export async function sendPayment (bolt11, { nwcUrl }, { signal }) {
  const nwc = await getNwc(nwcUrl, { signal })
  // TODO: support AbortSignal
  const result = await nwcTryRun(() => nwc.payInvoice(bolt11))
  return result.preimage
}
