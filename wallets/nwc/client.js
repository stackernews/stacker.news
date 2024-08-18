import { hasMethod, nwcCall } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function testConnectClient ({ nwcUrl }, { logger }) {
  // TODO:
  //   This will also run if only receive config was specified.
  //   This means that this will either
  //     a) enforce that 'pay_invoice' is supported which is the opposite of what we want
  //       OR
  //     b) throw because nwcUrl is undefined.
  await hasMethod(nwcUrl, 'pay_invoice', { logger })
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
