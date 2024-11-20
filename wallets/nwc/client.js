import { getNwc, supportedMethods } from '@/wallets/nwc'
export * from '@/wallets/nwc'

export async function testSendPayment ({ nwcUrl }, { logger }) {
  const timeout = 15_000

  const supported = await supportedMethods(nwcUrl, { logger, timeout })
  if (!supported.includes('pay_invoice')) {
    throw new Error('pay_invoice not supported')
  }
}

export async function sendPayment (bolt11, { nwcUrl }, { logger }) {
  const nwc = await getNwc(nwcUrl)
  const { error, result } = await nwc.payInvoice(bolt11)
  if (error) throw new Error(error.code + ' ' + error.message)
  return result.preimage
}
