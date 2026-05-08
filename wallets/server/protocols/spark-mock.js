import { createHash, randomBytes } from 'node:crypto'
import { createInvoice as lnCreateInvoice, parsePaymentRequest } from 'ln-service'
import {
  getServiceWallet,
  invalidateServiceWallet,
  sparkCreateLightningInvoiceArgs
} from './spark'
import { stackerLnd } from '../spark-mock-lnd'

export const name = 'SPARK'

function paymentHashForPreimage (preimage) {
  return createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
}

// dev-only: the inner invoice lives on stacker lnd (not sn_lnd) so SN's wrap
// layer can create its own hodl at the same payment hash without collision.
// A regular (non-hodl) invoice with our preset preimage auto-settles when sn_lnd
// pays stacker, so the preimage flows back through the wrap forward naturally.
export async function createInvoice (args, config, { signal } = {}) {
  signal?.throwIfAborted()
  const wallet = await getServiceWallet({ signal })
  const preimage = randomBytes(32).toString('hex')
  const paymentHash = paymentHashForPreimage(preimage)

  signal?.throwIfAborted()
  // Still call the real Spark SSP for fidelity (exercises auth, SDK, network).
  // The returned sparkBolt11 isn't used downstream; we only validate hash commitment.
  let sparkRequest
  try {
    sparkRequest = await wallet.createLightningHodlInvoice({
      ...sparkCreateLightningInvoiceArgs(args, config),
      paymentHash
    })
  } catch (err) {
    invalidateServiceWallet()
    throw err
  }

  signal?.throwIfAborted()
  const sparkBolt11 = sparkRequest?.invoice?.encodedInvoice
  if (!sparkBolt11) {
    throw new Error('Spark did not return a bolt11 invoice')
  }

  const parsed = parsePaymentRequest({ request: sparkBolt11 })
  if (parsed.id !== paymentHash) {
    throw new Error('Spark mock payment hash mismatch')
  }

  const localRequest = await lnCreateInvoice({
    lnd: stackerLnd(),
    secret: preimage,
    mtokens: parsed.mtokens,
    ...(parsed.expires_at ? { expires_at: new Date(parsed.expires_at) } : {}),
    ...(parsed.description_hash
      ? { description_hash: parsed.description_hash }
      : parsed.description
        ? { description: parsed.description }
        : {})
  })

  const bolt11 = localRequest?.request
  if (!bolt11) {
    throw new Error('Spark mock did not return a local bolt11 invoice')
  }

  return bolt11
}

export async function testCreateInvoice ({ identityPubkey }, opts) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { identityPubkey },
    opts
  )
}
