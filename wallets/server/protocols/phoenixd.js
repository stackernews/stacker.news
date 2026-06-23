import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { truncateToCharLength } from '@/lib/validate'
import {
  getIncomingPayment,
  phoenixdCompletedAt,
  phoenixdFormBody,
  phoenixdRequest
} from '@/wallets/lib/phoenixd'

export const name = 'PHOENIXD'
// phoenixd only invoices whole sats, so it can receive a request snapped down to the sat grid
export const receivableMsats = msatsSatsFloor
// phoenixd rejects descriptions over 128 chars, so clamp
export const receivableDescription = description => truncateToCharLength(description, 128)

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, apiKey },
  { signal }
) {
  // https://phoenix.acinq.co/server/api#create-bolt11-invoice
  const payment = await phoenixdRequest({
    url,
    apiKey,
    path: '/createinvoice',
    method: 'POST',
    body: phoenixdFormBody({
      description,
      amountSat: msatsToSats(msats),
      expirySeconds: expiry
    }),
    signal
  })

  return payment.serialized
}

export async function checkInvoice ({ hash }, { url, apiKey }, { signal }) {
  const payment = await getIncomingPayment({ paymentHash: hash }, { url, apiKey }, { signal })
  if (!payment) return { status: 'PENDING' }

  if (payment.isPaid) {
    return {
      status: 'SETTLED',
      preimage: payment.preimage,
      actualFeeMsats: walletAmountToMsatsOrUndefined(payment.fees),
      settledAt: phoenixdCompletedAt(payment)
    }
  }
  // phoenixd's incoming-payment response has no expiry flag, so we can't self-report expiry here; the
  // worker force-fails the row once the bolt11 expiry + grace window passes.
  return { status: 'PENDING' }
}

export async function testCreateInvoice ({ url, apiKey }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url, apiKey },
    { signal })
}
