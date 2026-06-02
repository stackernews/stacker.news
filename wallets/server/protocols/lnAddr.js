import { msatsSatsFloor } from '@/lib/format'
import { fetchInvoiceFromCallback, fetchLnAddrService, lnAddrInvoiceUrl } from '@/lib/lnurl'
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

  return body.pr
}

export const testCreateInvoice = async ({ address }, { signal }) => {
  return await createInvoice({ msats: undefined }, { address }, { signal })
}
