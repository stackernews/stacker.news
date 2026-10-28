import { domainsMappingsCache } from '@/lib/domains'
import { buildAllowlist, isAuthorizedCaptureRequest } from '@/lib/domains/allowlist'

/**
 * The custom domain allowlist for the capture service.
 *
 * capture runs a headless browser on our infra and is publicly reachable, so it refuses
 * to navigate anywhere it can't prove is ours. It can't read the DB, so it mirrors
 * domainsMappingsCache through this endpoint and caches the answer with the same TTLs.
 *
 * Gated by a shared secret: the domains are public information, but an enumerable list
 * of every territory running on a custom domain is not something to hand out for free.
 */
export default async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'ERROR', reason: 'method not allowed' })
  }

  if (!isAuthorizedCaptureRequest(req.headers.authorization, process.env.CAPTURE_DOMAINS_SECRET)) {
    return res.status(401).json({ status: 'ERROR', reason: 'unauthorized' })
  }

  try {
    const mappings = await domainsMappingsCache()
    return res.status(200).json({ domains: buildAllowlist(mappings) })
  } catch (error) {
    console.error('[capture/domains] cannot build the allowlist:', error.message)
    return res.status(500).json({ status: 'ERROR', reason: 'cannot build the allowlist' })
  }
}
