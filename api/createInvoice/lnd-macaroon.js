import { createInvoice, authenticatedLndGrpc } from 'ln-service'
import { datePivot } from '@/lib/time'

export default async ({ cert, macaroon, socket }, { msats, description, expiry }) => {
  // connect to the lnd
  const { lnd } = await authenticatedLndGrpc({
    cert,
    macaroon,
    socket
  })

  // get the invoice
  const invoice = await createInvoice({
    lnd,
    mtokens: String(msats),
    description,
    expires_at: datePivot(new Date(), { seconds: expiry })
  })

  return invoice.request
}
