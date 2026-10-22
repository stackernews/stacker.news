import { getDomainMapping } from '@/lib/domains'
import { parseSafeHost } from '@/lib/safe-url'

// Expose only the active hostname, never the cached authentication metadata.
export default async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const host = parseSafeHost(req.query.domain)
  if (!host || host.port) return res.status(400).end()

  try {
    const mapping = await getDomainMapping(host.hostname)
    if (!mapping) return res.status(404).end()
    return res.status(200).json({ domain: host.hostname })
  } catch {
    return res.status(503).end()
  }
}
