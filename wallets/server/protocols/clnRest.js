import { createInvoice as clnCreateInvoice, getInvoice as clnGetInvoice, runeMayAllowMethod } from '@/lib/cln'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { WalletPermissionsError } from '@/wallets/client/errors'
import { EXTERNAL_TRANSACTION_UNKNOWN_REASONS } from '@/wallets/lib/external-transactions'

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
  // a receive-only rune deliberately omits listinvoices (the field help endorses this), so settlement
  // can never be verified for it — classify as unsupported (stop polling, benign message) rather than
  // PERMISSION_REQUIRED, which would re-poll for 24h with a misleading "update wallet permissions" notice
  if (!runeMayAllowMethod(rune, 'listinvoices')) {
    return {
      status: 'UNKNOWN',
      unknownReason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED,
      error: 'cln rune does not allow listinvoices'
    }
  }

  const invoice = await clnGetInvoice({ paymentHash: hash }, { socket, rune, cert }, { signal })
  if (!invoice) return { status: 'PENDING' }

  if (invoice.status === 'paid') {
    const receivedMsats = walletAmountToMsatsOrUndefined(invoice.amount_received_msat)

    return {
      status: 'SETTLED',
      preimage: invoice.payment_preimage,
      settledAt: invoice.paid_at ? new Date(Number(invoice.paid_at) * 1000) : undefined,
      msats: receivedMsats
    }
  }
  if (invoice.status === 'expired') {
    return {
      status: 'FAILED',
      error: 'cln invoice expired'
    }
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
