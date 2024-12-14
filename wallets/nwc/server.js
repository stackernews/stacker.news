import { getNwc, supportedMethods, nwcTryRun } from '@/wallets/nwc'
export * from '@/wallets/nwc'

export async function testCreateInvoice ({ nwcUrlRecv }, { signal }) {
  const supported = await supportedMethods(nwcUrlRecv, { signal })

  const supports = (method) => supported.includes(method)

  if (!supports('make_invoice')) {
    throw new Error('make_invoice not supported')
  }

  const mustNotSupport = ['pay_invoice', 'multi_pay_invoice', 'pay_keysend', 'multi_pay_keysend']
  for (const method of mustNotSupport) {
    if (supports(method)) {
      throw new Error(`${method} must not be supported`)
    }
  }

  return await createInvoice({ msats: 1000, expiry: 1 }, { nwcUrlRecv }, { signal })
}

export async function createInvoice ({ msats, description, expiry }, { nwcUrlRecv }, { signal }) {
  const nwc = await getNwc(nwcUrlRecv, { signal })
  // TODO: support AbortSignal
  const result = await nwcTryRun(() => nwc.sendReq('make_invoice', { amount: msats, description, expiry }))
  return result.invoice
}
