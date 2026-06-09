import { parseSafeHost, safeRedirectPath } from '@/lib/safe-url'
import { SN_MAIN_DOMAIN } from '@/lib/domains'
import { DOMAINS_AUTH_VERIFIER_COOKIE, isValidHex64 } from '@/lib/domains/auth'
import * as cookie from 'cookie'
import { cookieOptions, buildMultiAuthCookies, MULTI_AUTH_LIST, SESSION_COOKIE } from '@/lib/auth'

/**
 * Step 3 of the custom domain auth flow
 * responsible for
 * - verifying the code, calling /api/auth/domains/token to exchange it for a session token
 * - setting the session cookie on the custom domain
 * - setting the multi-auth cookies on the custom domain
 * - redirecting to the custom domain
 *
 * visited on the custom domain after a successful main domain /api/auth/domains/code request.
 */
export default async function handler (req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'ERROR', reason: 'method not allowed' })
  }

  try {
    const { code, redirectUri: rawRedirectUri } = req.query
    if (!isValidHex64(code) || !rawRedirectUri) {
      return res.status(400).json({ status: 'ERROR', reason: 'code and redirectUri are required' })
    }

    const domain = req.headers.host
    const redirectUri = safeRedirectPath(rawRedirectUri, domain)
    const parsedDomain = parseSafeHost(domain)

    // get the verifier from custom domain cookies
    const verifier = req.cookies[DOMAINS_AUTH_VERIFIER_COOKIE]
    if (!isValidHex64(verifier)) {
      return res.status(400).json({ status: 'ERROR', reason: 'verifier is not valid' })
    }

    // exchange the code for a session token
    const tokenData = await exchangeCode(parsedDomain.hostname, code, verifier)
    // set the session cookie
    res.appendHeader('Set-Cookie', cookie.serialize(SESSION_COOKIE, tokenData.sessionToken, cookieOptions({ req })))

    // mirror multi-auth state on the custom domain so the account picker also works here.
    // each per-user JWT is the domain-bound session token minted for THIS domain (not the
    // main-domain JWT), so when switchSessionCookie swaps it in, the [...nextauth] jwt
    // callback's domainName/tokenVersion check still passes.
    if (tokenData.user?.id != null) {
      const multiAuthCookies = buildMultiAuthCookies(
        req.cookies[MULTI_AUTH_LIST],
        {
          id: tokenData.user.id,
          jwt: tokenData.sessionToken,
          name: tokenData.user.name,
          photoId: tokenData.user.photoId
        },
        req
      )
      for (const { name, value, options } of multiAuthCookies) {
        res.appendHeader('Set-Cookie', cookie.serialize(name, value, options))
      }
    }

    return res.redirect(302, redirectUri)
  } catch (error) {
    console.error('[domains-auth] cannot verify code', error)
    return res.status(500).json({ status: 'ERROR', reason: 'cannot verify code' })
  }
}

async function exchangeCode (domainName, code, verifier) {
  const body = JSON.stringify({
    code,
    domainName,
    verifier
  })
  const fetchHeaders = new Headers()
  fetchHeaders.set('Content-Type', 'application/json')

  const response = await fetch(`${SN_MAIN_DOMAIN.origin}/api/auth/domains/token`, {
    method: 'POST',
    headers: fetchHeaders,
    body,
    signal: AbortSignal.timeout(10000)
  })

  const data = await response.json()
  if (data.status === 'ERROR') {
    throw new Error(data.reason)
  }

  return data
}
