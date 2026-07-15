import { createInvoice as clnCreateInvoice, getInvoice as clnGetInvoice, runeMayAllowMethod } from '@/lib/cln'
import { epochSecondsToDate } from '@/lib/time'
import { WalletPermissionsError } from '@/wallets/lib/errors'

export const name = 'CLN_REST'

export const createInvoice = async (
  { msats, description, expiry },
  { socket, rune, cert },
  { signal }
) => {
  const inv = await clnCreateInvoice(
    {
      msats,
      description,
      expiry
    },
    {
      socket,
      rune,
      cert
    },
    { signal })

  return inv.bolt11
}

export const checkInvoice = async (
  { hash },
  { socket, rune, cert },
  { signal }
) => {
  // Keep the transaction open so corrected credentials can resume verification.
  if (!runeMayAllowMethod(rune, 'listinvoices')) {
    throw new WalletPermissionsError('credentials do not allow checking invoices')
  }

  const invoice = await clnGetInvoice({ paymentHash: hash }, { socket, rune, cert }, { signal })
  if (!invoice) return { status: 'PENDING' }

  if (invoice.status === 'paid') {
    return {
      status: 'SETTLED',
      preimage: invoice.payment_preimage,
      settledAt: epochSecondsToDate(invoice.paid_at),
      msats: invoice.amount_received_msat
    }
  }
  if (invoice.status === 'expired') {
    return { status: 'EXPIRED' }
  }

  return { status: 'PENDING' }
}

export const testCreateInvoice = async ({ socket, rune, cert }, { signal }) => {
  if (!runeMayAllowMethod(rune, 'invoice')) {
    throw new WalletPermissionsError('credentials do not allow receiving')
  }

  return await createInvoice(
    { msats: 1000, expiry: 1, description: 'SN test invoice' },
    { socket, rune, cert },
    { signal }
  )
}
