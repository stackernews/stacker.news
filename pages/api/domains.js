import { parseSafeHost } from '@/lib/safe-url'
import { domainsMappingsCache, getDomainMapping } from '@/lib/domains'

/**
 * Safe read-only endpoint exposing active custom domain mappings for the capture service.
 * Never exposes internal security fields (id, tokenVersion).
 */
export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ status: 'ERROR', reason: 'method not allowed' })
  }

  const { domain } = req.query
  if (domain !== undefined) {
    const parsed = parseSafeHost(domain)
    const mapping = parsed && await getDomainMapping(parsed.hostname)
    if (!parsed || !mapping) {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(404).json({ status: 'ERROR', reason: 'domain not found' })
    }

    res.setHeader('Cache-Control', 'public, max-age=60')
    return res.status(200).json({
      domainName: mapping.domainName,
      subName: mapping.subName
    })
  }

  const mappings = await domainsMappingsCache()
  const domains = mappings
    ? Object.values(mappings).map(({ domainName, subName }) => ({ domainName, subName }))
    : []

  res.setHeader('Cache-Control', 'public, max-age=60')
  return res.status(200).json({ domains })
}
