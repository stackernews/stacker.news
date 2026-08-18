import { WalletPermissionsError, WalletVerificationUnsupportedError } from '@/wallets/lib/errors'
import {
  NWC_PAY_INVOICE_METHOD,
  nwcLookupInvoice,
  nwcLookupNotFound,
  nwcLookupUnsupported,
  nwcTryRun,
  supportedMethods
} from '@/wallets/lib/protocols/nwc'
import { msatsSatsFloor } from '@/lib/format'

export const name = 'NWC'
export const supportsDescriptionHash = true

// AlbyHub's NWC only invoices whole sats as of https://github.com/getAlby/hub/commit/64afc2227f128cf4cd90daf0d844af48e3513166
export const receivableMsats = msatsSatsFloor

export async function createInvoice ({ msats, description, descriptionHash, expiry }, { url }, { signal }) {
  const result = await nwcTryRun(
    nwc => nwc.req('make_invoice', {
      amount: msats,
      expiry,
      ...(descriptionHash ? { description_hash: descriptionHash } : { description })
    }),
    { url },
    { signal }
  )
  return result.result.invoice
}

export async function checkInvoice ({ hash }, { url }, { signal }) {
  let invoice
  try {
    invoice = await nwcLookupInvoice(hash, { url }, { signal })
  } catch (err) {
    if (nwcLookupUnsupported(err)) {
      throw new WalletVerificationUnsupportedError(err.message || 'nwc wallet does not support lookup_invoice')
    }
    if (nwcLookupNotFound(err)) return { status: 'PENDING', detail: 'nwc invoice not found' }
    throw err
  }

  if (!invoice) return { status: 'PENDING', detail: 'nwc invoice not found' }
  if (invoice.type !== 'incoming') {
    return {
      status: 'UNKNOWN',
      detail: 'nwc lookup_invoice did not return an incoming invoice'
    }
  }

  // settlement is signaled by a non-null settled_at; `state` is a later NIP-47 addition that many
  // wallets (and the NDK response type) omit, so relying on it alone leaves settled receives PENDING
  if (invoice.state === 'settled' || invoice.settled_at) {
    return {
      status: 'SETTLED',
      preimage: invoice.preimage,
      settledAt: { seconds: invoice.settled_at },
      // lookup_invoice.fees_paid on an incoming invoice is payer/routing fees, not a fee the
      // receiver paid — don't record it as the receive transaction's actualFeeMsats.
      msats: invoice.amount
    }
  }
  if (invoice.state === 'expired') {
    return { status: 'EXPIRED' }
  }
  if (invoice.state === 'failed') {
    return {
      status: 'FAILED',
      detail: 'nwc invoice failed'
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
