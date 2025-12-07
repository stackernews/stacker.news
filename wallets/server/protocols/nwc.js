import { WalletPermissionsError } from '@/wallets/client/errors'
import { nwcTryRun, supportedMethods } from '@/wallets/lib/protocols/nwc'

export const name = 'NWC'

export async function createInvoice ({ msats, description, expiry }, { url }, { signal }) {
  const result = await nwcTryRun(
    nwc => nwc.req('make_invoice', { amount: msats, description, expiry }),
    { url },
    { signal }
  )
  return result.result.invoice
}

export async function testCreateInvoice ({ url }, { signal }) {
  const supported = await supportedMethods(url, { signal })
  const supports = (method) => supported.includes(method)

  if (!supports('make_invoice')) {
    throw new WalletPermissionsError('credentials do not allow receiving')
  }

  const mustNotSupport = ['pay_invoice', 'multi_pay_invoice', 'pay_keysend', 'multi_pay_keysend']
  for (const method of mustNotSupport) {
    if (supports(method)) {
      throw new WalletPermissionsError('credentials allow spending')
    }
  }

  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url },
    { signal }
  )
}
