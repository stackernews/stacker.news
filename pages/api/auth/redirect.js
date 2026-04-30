import { SN_MAIN_DOMAIN, getDomainMapping, normalizeDomain } from '@/lib/domains'

// auth redirect for custom domains
// redirects to /login or /signup on the main domain,
// with a callbackUrl that points to auth sync
export default async function handler (req, res) {
  const { domain, signup, callbackUrl } = req.query
  if (!domain) {
    return res.status(400).json({ status: 'ERROR', reason: 'domain is required' })
  }

  const { domainName } = normalizeDomain(domain)
  const mapping = await getDomainMapping(domainName)
  if (!mapping) {
    return res.status(400).json({ status: 'ERROR', reason: 'domain not allowed' })
  }

  const redirectUri = normalizeRedirectUri(callbackUrl, domainName)

  const syncPath = `/api/auth/sync?domain=${encodeURIComponent(domain)}&redirectUri=${encodeURIComponent(redirectUri)}`

  const loginUrl = new URL(signup ? '/signup' : '/login', SN_MAIN_DOMAIN)
  loginUrl.searchParams.set('domain', domain)
  loginUrl.searchParams.set('callbackUrl', syncPath)
  if (signup) loginUrl.searchParams.set('syncSignup', 'true')

  res.redirect(302, loginUrl.href)
}

// only same-origin paths or absolute URLs that point at the requested custom
// domain are accepted. collapse to '/' otherwise.
function normalizeRedirectUri (uri, domainName) {
  if (!uri) return '/'
  if (uri.startsWith('/')) return uri

  try {
    const parsed = new URL(uri)
    if (normalizeDomain(parsed.host).domainName === domainName) {
      return (parsed.pathname || '/') + parsed.search + parsed.hash
    }
  } catch {}
  return '/'
}
