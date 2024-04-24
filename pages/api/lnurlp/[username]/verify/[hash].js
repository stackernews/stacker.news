import lnd from '@/api/lnd'
import { getInvoice } from 'ln-service'

export default async ({ query: { hash } }, res) => {
  try {
    const inv = await getInvoice({ id: hash, lnd })
    const settled = inv.is_confirmed
    return res.status(200).json({ status: 'OK', settled, preimage: settled ? inv.secret : null, pr: inv.request })
  } catch (err) {
    if (err[1] === 'UnexpectedLookupInvoiceErr') {
      return res.status(404).json({ status: 'ERROR', reason: 'not found' })
    }
    return res.status(500).json({ status: 'ERROR', reason: 'internal server error' })
  }
}
