import { DOMAINS_AUTH_VERIFIER_COOKIE, deriveChallenge, isValidHex64, safeEqual } from '@/lib/domains/auth'
import { parseSafeHost, formatHost, safeRedirectPath } from '@/lib/safe-url'
import { getDomainMapping, SN_MAIN_DOMAIN } from '@/lib/domains'

/**
 * Step 1 of the custom domain auth flow
 * responsible for redirecting to main domain /login or /signup retaining the auth query params.
 *
 * swaps the original callbackUrl for /api/auth/domains/code with challenge and redirectUri (the original callbackUrl).
 *
 * Next.js cannot redirect to an absolute localhost URL, it gets converted to a relative URL.
 * https://github.com/vercel/next.js/issues/44482
 *
 * visited on the custom domain after the user clicks "login"/"signup".
 */
export default async function handler (req, res) {
  const { domain, callbackUrl, signup, multiAuth, challenge } = req.query
  const parsedDomain = parseSafeHost(domain)
  // restrict to ACTIVE custom domains so this endpoint cannot be used as an open redirect.
  const mapping = parsedDomain && await getDomainMapping(parsedDomain.hostname)
  if (!parsedDomain || !mapping) {
    return res.status(400).json({ status: 'ERROR', reason: 'domain not allowed' })
  }

  const canonicalDomain = formatHost(parsedDomain)
  // redirectUri is the path the user will be redirected to after authentication
  // distinguishes between login flow (callbackUrl) and domains auth flow (redirectUri)
  const redirectUri = safeRedirectPath(callbackUrl, canonicalDomain)
  // multi-auth is the "add existing account" intent. it never makes sense to
  // pair it with signup, which always creates a fresh user.
  const wantsMultiAuth = !signup && multiAuth === 'true'

  // the auth verifier is set as a cookie on the custom domain by middleware's redirectToAuth.
  // if it's missing, we bounce back to the custom domain to mint a fresh one.
  const verifier = req.cookies[DOMAINS_AUTH_VERIFIER_COOKIE]
  if (!isValidHex64(challenge) || !isValidHex64(verifier) || !safeEqual(challenge, deriveChallenge(verifier))) {
    // TODO: piggyback on the main domain's protocol, might be misleading to read
    const protocol = SN_MAIN_DOMAIN.protocol
    const retry = new URL(signup ? '/signup' : '/login', `${protocol}//${canonicalDomain}`)
    if (redirectUri) retry.searchParams.set('callbackUrl', redirectUri)
    if (wantsMultiAuth) retry.searchParams.set('multiAuth', 'true')
    return res.redirect(302, retry.href)
  }

  // build code request URL
  const requestCodeUrl = new URL('/api/auth/domains/code', SN_MAIN_DOMAIN)
  requestCodeUrl.searchParams.set('domain', canonicalDomain)
  requestCodeUrl.searchParams.set('challenge', challenge)
  requestCodeUrl.searchParams.set('redirectUri', redirectUri)

  // build login URL
  // with code request URL as callbackUrl (where next auth redirects to at the end of the main login flow)
  const loginUrl = new URL(signup ? '/signup' : '/login', SN_MAIN_DOMAIN)
  if (wantsMultiAuth) loginUrl.searchParams.set('multiAuth', 'true')
  loginUrl.searchParams.set('domain', canonicalDomain)
  loginUrl.searchParams.set('callbackUrl', requestCodeUrl.pathname + requestCodeUrl.search)

  return res.redirect(302, loginUrl.href)
}
