import { SN_MAIN_DOMAIN, getDomainMapping } from '@/lib/domains'
import { formatHost, parseSafeHost, safeRedirectPath } from '@/lib/safe-url'

// auth redirect for custom domains
// redirects to /login or /signup on the main domain,
// with a callbackUrl that points to auth sync
export default async function handler (req, res) {
  const { domain, signup, callbackUrl } = req.query
  const parsedDomain = parseSafeHost(domain)
  if (!parsedDomain) {
    return res.status(400).json({ status: 'ERROR', reason: 'domain is required' })
  }

  const domainName = parsedDomain.hostname
  const mapping = await getDomainMapping(domainName)
  if (!mapping) {
    return res.status(400).json({ status: 'ERROR', reason: 'domain not allowed' })
  }

  const canonicalDomain = formatHost(parsedDomain)
  const redirectUri = safeRedirectPath(callbackUrl, canonicalDomain)

  const syncPath = `/api/auth/sync?domain=${encodeURIComponent(canonicalDomain)}&redirectUri=${encodeURIComponent(redirectUri)}`

  const loginUrl = new URL(signup ? '/signup' : '/login', SN_MAIN_DOMAIN)
  loginUrl.searchParams.set('domain', canonicalDomain)
  loginUrl.searchParams.set('callbackUrl', syncPath)

  res.redirect(302, loginUrl.href)
}
