import { WalletPermissionsError } from '@/wallets/client/errors'
import { NWC_PAY_INVOICE_METHOD, nwcTryRun, supportedMethods } from '@/wallets/lib/protocols/nwc'
import { msatsSatsFloor } from '@/lib/format'

export const name = 'NWC'

// AlbyHub's NWC only invoices whole sats as of https://github.com/getAlby/hub/commit/64afc2227f128cf4cd90daf0d844af48e3513166
export const receivableMsats = msatsSatsFloor

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

  const mustNotSupport = [NWC_PAY_INVOICE_METHOD, 'multi_pay_invoice', 'pay_keysend', 'multi_pay_keysend']
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
