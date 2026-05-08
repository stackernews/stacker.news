import { payViaPaymentRequest } from 'ln-service'
import { getServerSession } from 'next-auth/next'
import { LND_PATHFINDING_TIME_PREF_PPM, LND_PATHFINDING_TIMEOUT_MS } from '@/lib/constants'
import { multiAuthMiddleware } from '@/lib/auth'
import { stackerLnd } from '@/wallets/server/spark-mock-lnd'
import { getAuthOptions } from '../auth/[...nextauth]'

const SPARK_MOCK_MAX_FEE_SATS = 1000

function isSparkMockEnabled () {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_SPARK_MOCK === '1'
}

// dev-only: the Spark client mock POSTs bolt11s here so stacker lnd pays them
// on behalf of a Spark send wallet that has no sndev routing. Works for any
// destination (Spark recv via sn_lnd wrap, other SN wallets, external LN).
export default async function handler (req, res) {
  if (!isSparkMockEnabled()) {
    res.status(404).end()
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  req = await multiAuthMiddleware(req, res)
  const session = await getServerSession(req, res, getAuthOptions(req))
  if (!session?.user) {
    res.status(401).json({ error: 'authentication required' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!body?.bolt11) {
      res.status(400).json({ error: 'bolt11 is required' })
      return
    }

    const paid = await payViaPaymentRequest({
      lnd: stackerLnd(),
      request: body.bolt11,
      max_fee: SPARK_MOCK_MAX_FEE_SATS,
      pathfinding_timeout: LND_PATHFINDING_TIMEOUT_MS,
      confidence: LND_PATHFINDING_TIME_PREF_PPM
    })
    res.status(200).json({ preimage: paid.secret })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
