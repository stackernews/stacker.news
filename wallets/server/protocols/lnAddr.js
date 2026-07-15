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
  const { min } = service

  if (!msats) {
    msats = 1_000 * min
  }

  msats = Math.max(msats, 1_000)

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

  if (body.verify) {
    return {
      bolt11: body.pr,
      verificationContext: { lnurlVerifyUrl: body.verify }
    }
  }

  return body.pr
}
export const testCreateInvoice = async ({ address }, { signal }) => {
  return await createInvoice({ msats: undefined }, { address }, { signal })
}
