import { WalletPermissionsError } from '@/wallets/client/errors'
import { verificationUnsupportedResult } from '@/wallets/lib/external-transactions'
import { NWC_PAY_INVOICE_METHOD, nwcTryRun, supportedMethods } from '@/wallets/lib/protocols/nwc'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'

export const name = 'NWC'

export async function createInvoice ({ msats, description, expiry }, { url }, { signal }) {
  const result = await nwcTryRun(
    nwc => nwc.req('make_invoice', { amount: msats, description, expiry }),
    { url },
    { signal }
  )
  return result.result.invoice
}

export async function checkInvoice ({ hash }, { url }, { signal }) {
  let result
  try {
    result = await nwcTryRun(
      nwc => nwc.req('lookup_invoice', { payment_hash: hash }),
      { url },
      { signal }
    )
  } catch (err) {
    if (err?.nwcError?.code === 'NOT_IMPLEMENTED') {
      return verificationUnsupportedResult(err.message || 'nwc wallet does not support lookup_invoice')
    }
    if (err?.nwcError?.code === 'NOT_FOUND') return { status: 'PENDING', error: 'nwc invoice not found' }
    throw err
  }
  const invoice = result.result

  if (!invoice) return { status: 'PENDING', error: 'nwc invoice not found' }

  // settlement is signaled by a non-null settled_at; `state` is a later NIP-47 addition that many
  // wallets (and the NDK response type) omit, so relying on it alone leaves settled receives PENDING
  if (invoice.state === 'settled' || invoice.settled_at) {
    return {
      status: 'SETTLED',
      preimage: invoice.preimage,
      settledAt: invoice.settled_at ? new Date(invoice.settled_at * 1000) : undefined,
      // lookup_invoice.fees_paid on an incoming invoice is payer/routing fees, not a fee the
      // receiver paid — don't record it as the receive transaction's actualFeeMsats.
      msats: walletAmountToMsatsOrUndefined(invoice.amount)
    }
  }
  if (['expired', 'failed'].includes(invoice.state)) {
    return {
      status: 'FAILED',
      error: `nwc invoice ${invoice.state}`
    }
  }

  return { status: 'PENDING' }
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
