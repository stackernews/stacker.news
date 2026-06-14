import { getDomainBranding } from '@/lib/domains'
import { getRequestOrigin } from '@/lib/safe-url'
import { getManifest } from '@/lib/site-webmanifest'

const handler = async (req, res) => {
  // Only GET requests allowed on this endpoint
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }
  const PREFERS_COLOR_SCHEMA_HEADER = 'Sec-CH-Prefers-Color-Scheme'
  // This endpoint wants to know the preferred color scheme
  res.setHeader('Accept-CH', PREFERS_COLOR_SCHEMA_HEADER)
  // The response of this endpoint will vary based on the color scheme
  res.setHeader('Vary', PREFERS_COLOR_SCHEMA_HEADER)
  // Ensure the header is sent in the request - forces user agent to reissue the request if it wasn't sent
  res.setHeader('Critical-CH', PREFERS_COLOR_SCHEMA_HEADER)

  const colorScheme = req.headers[PREFERS_COLOR_SCHEMA_HEADER.toLowerCase()]

  const host = req?.headers?.host
  let domainBranding = null
  if (host) {
    try {
      domainBranding = await getDomainBranding(host)
    } catch (error) {
      console.error('[pwa webmanifest] error getting domain branding', error)
      domainBranding = null
    }
  }

  // only trust the request origin when we resolved a custom-domain branding;
  // mirrors the pattern in lib/rss.js so the main site keeps its canonical URL
  const origin = (domainBranding && getRequestOrigin(req)) ?? null

  // cached aggressively for territory-branded responses, shorter TTL for unbranded responses
  // branded responses are URL-versioned via ?v=<branding.updatedAt> in _document.js,
  // so when the domain mappings cache expires, we bust the manifest cache too, allowing us to cache aggressively.
  const cacheControl = domainBranding
    ? 'public, max-age=86400, stale-while-revalidate=604800' // 1 day for territory-branded responses
    : 'public, max-age=3600, stale-while-revalidate=86400' // 1 hour for SN responses
  res.setHeader('Cache-Control', cacheControl)

  res.status(200).json(getManifest(colorScheme, domainBranding, origin))
}

export default handler
