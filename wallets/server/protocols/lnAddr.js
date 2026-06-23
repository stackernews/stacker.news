import { msatsSatsFloor } from '@/lib/format'
import { fetchInvoiceFromCallback, fetchLnAddrService, fetchLnAddrVerify, lnAddrInvoiceUrl } from '@/lib/lnurl'
import { truncateToCharLength } from '@/lib/validate'

export const name = 'LN_ADDR'
// lnurl providers generally only invoice whole sats
export const receivableMsats = msatsSatsFloor

export const createInvoice = async (
  { msats, description },
  { address },
  { signal }
) => {
  const service = await fetchLnAddrService(address, { signal })
  // min is already validated as a safe integer >= 1 by lnAddrSatsLimits inside fetchLnAddrService
  const { min } = service

  if (!msats) {
    // use min sendable amount by default
    msats = 1_000 * min
  }

  // create invoices with a minimum amount of 1 sat
  msats = Math.max(msats, 1_000)

  // most lnurl providers suck nards so we have to floor to nearest sat
  msats = msatsSatsFloor(msats)

  // LUD-12 measures comments in characters; keep as much memo as allowed
  const comment = service.commentAllowed > 0
    ? truncateToCharLength(description, service.commentAllowed)
    : undefined
  const body = await fetchInvoiceFromCallback(lnAddrInvoiceUrl(
    service,
    { msats, comment }
  ), { signal })

  if (!body.pr) {
    throw new Error('lightning address did not return a bolt11 invoice')
  }

  const verificationContext = lnurlVerifyContext(body.verify)
  if (verificationContext) return { bolt11: body.pr, verificationContext }

  return body.pr
}

export async function checkInvoice (transaction, _config, { signal } = {}) {
  const verifyUrl = transaction.verificationContext?.lnurlVerifyUrl
  if (!verifyUrl) return null

  const body = await fetchLnAddrVerify(verifyUrl, { signal })
  if (body.status === 'ERROR') {
    return {
      status: 'UNKNOWN',
      error: body.reason ?? 'lightning address verify failed'
    }
  }

  if (body.pr && body.pr.toLowerCase() !== transaction.bolt11.toLowerCase()) {
    // the provider's verify endpoint is bound to a different invoice — this won't
    // self-correct, so fail fast instead of re-polling every interval until expiry.
    return {
      status: 'FAILED',
      error: 'lightning address verify returned a different invoice'
    }
  }

  if (body.settled === true) {
    return {
      status: 'SETTLED',
      preimage: body.preimage
    }
  }
  if (body.settled === false) {
    return { status: 'PENDING' }
  }

  return {
    status: 'UNKNOWN',
    error: 'lightning address verify returned an unknown status'
  }
}

export const testCreateInvoice = async ({ address }, { signal }) => {
  return await createInvoice({ msats: undefined }, { address }, { signal })
}

function lnurlVerifyContext (verify) {
  if (!verify) return null
  try {
    return { lnurlVerifyUrl: new URL(verify).toString() }
  } catch {
    return null
  }
}
