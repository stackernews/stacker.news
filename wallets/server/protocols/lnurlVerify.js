import { fetchLnAddrVerify } from '@/lib/lnurl'
import { verifyPreimage } from '@/wallets/lib/preimage'

export async function checkLnurlVerifyInvoice (transaction, _config, { signal } = {}) {
  const verifyUrl = transaction.verificationContext?.lnurlVerifyUrl
  const body = await fetchLnAddrVerify(verifyUrl, { signal })
  if (body.status === 'ERROR') {
    return {
      status: 'UNKNOWN',
      detail: body.reason ?? 'lightning address verify failed'
    }
  }

  if (typeof body.pr !== 'string' ||
      typeof transaction.bolt11 !== 'string' ||
      body.pr.toLowerCase() !== transaction.bolt11.toLowerCase()) {
    // A missing or mismatched binding says nothing about the stored invoice.
    return {
      status: 'UNKNOWN',
      detail: 'lightning address verify did not bind the stored invoice'
    }
  }

  if (body.settled === true) {
    if (!verifyPreimage(transaction.hash, body.preimage)) {
      return {
        status: 'UNKNOWN',
        detail: 'lightning address verify returned invalid settlement proof'
      }
    }
    return {
      status: 'SETTLED',
      preimage: body.preimage
    }
  }
  if (body.settled === false) return { status: 'PENDING' }

  return {
    status: 'UNKNOWN',
    detail: 'lightning address verify returned an unknown status'
  }
}
