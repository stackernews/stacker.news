import { getNwc, supportedMethods, nwcTryRun } from '@/wallets/nwc'
export * from '@/wallets/nwc'

export async function testSendPayment ({ nwcUrl }) {
  const timeout = 15_000

  const supported = await supportedMethods(nwcUrl, { timeout })
  if (!supported.includes('pay_invoice')) {
    throw new Error('pay_invoice not supported')
  }
}

export async function sendPayment (bolt11, { nwcUrl }) {
  const nwc = await getNwc(nwcUrl)
  const result = await nwcTryRun(() => nwc.payInvoice(bolt11))
  return result.preimage
}
