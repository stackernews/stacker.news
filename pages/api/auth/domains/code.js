import models from '@/api/models'
import { parseSafeHost, formatHost, safeRedirectPath } from '@/lib/safe-url'
import { multiAuthMiddleware } from '@/lib/auth'
import { getToken } from 'next-auth/jwt'
import { isValidHex64 } from '@/lib/domains/auth'
import { SN_MAIN_DOMAIN } from '@/lib/domains'
import { DOMAINS_AUTH_CODE_EXPIRY_MS } from '@/lib/constants'
import { randomBytes } from 'node:crypto'

/**
 * Step 2 of the custom domain auth flow
 * responsible for creating a verification code tied to the current main domain session and storing it in the DB
 * redirects to the custom domain /api/auth/domains/verify with the code as query param for verification.
 *
 * visited on the main domain after the user clicks "login" on the main domain.
 */
export default async function handler (req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'ERROR', reason: 'method not allowed' })
  }

  try {
    const { domain, redirectUri: rawRedirectUri, challenge } = req.query
    const parsedDomain = parseSafeHost(domain)
    if (!parsedDomain) {
      return res.status(400).json({ status: 'ERROR', reason: 'domain is required' })
    }

    const challengeValidation = isValidHex64(challenge)
    if (!challengeValidation) {
      return res.status(400).json({ status: 'ERROR', reason: 'challenge is not valid' })
    }

    const domainId = await getDomainId(parsedDomain.hostname)
    if (!domainId) {
      return res.status(400).json({ status: 'ERROR', reason: 'domain is not active' })
    }

    const canonicalDomain = formatHost(parsedDomain)
    const redirectUri = safeRedirectPath(rawRedirectUri, canonicalDomain)

    // honor multi auth cookie
    req = await multiAuthMiddleware(req, res)
    const sessionToken = await getToken({ req })
    if (!sessionToken) {
      return handleNoSession(res, canonicalDomain, redirectUri)
    }

    const newCode = await createCode(sessionToken, domainId, challenge)
    return redirectToVerification(res, canonicalDomain, newCode.code, redirectUri)
  } catch (error) {
    // TODO: better messages
    console.error('[auth/domains/code] cannot create a verification code: ', error.message)
    return res.status(500).json({ status: 'ERROR', reason: 'cannot create a verification code' })
  }
}

function handleNoSession (res, domainName, redirectUri, signup = false) {
  // bounce to /login (or /signup) on the *custom* domain, not the main one,
  // so the request passes through the custom-domain middleware
  // which mints a fresh nonce cookie and re-enters the flow.
  const customDomainLoginUrl = new URL(
    signup ? '/signup' : '/login',
    `${SN_MAIN_DOMAIN.protocol}//${domainName}`
  )
  if (redirectUri) {
    customDomainLoginUrl.searchParams.set('callbackUrl', redirectUri)
  }

  res.redirect(302, customDomainLoginUrl.href)
}

async function getDomainId (domainName) {
  const domain = await models.domain.findUnique({
    where: { domainName, status: 'ACTIVE' },
    select: { id: true }
  })

  return domain?.id
}

async function createCode (sessionToken, domainId, challenge) {
  const userId = Number(sessionToken.id)
  const code = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + DOMAINS_AUTH_CODE_EXPIRY_MS)

  const newCode = await models.domainAuthRequest.create({
    data: {
      userId,
      domainId,
      challenge,
      code,
      expiresAt
    }
  })

  return newCode
}

// redirects to the custom domain /api/auth/domains/verify with the code as query param
function redirectToVerification (res, canonicalDomain, code, redirectUri) {
  try {
    const protocol = SN_MAIN_DOMAIN.protocol
    const target = new URL('/api/auth/domains/verify', `${protocol}//${canonicalDomain}`)

    target.searchParams.set('code', code)
    target.searchParams.set('redirectUri', redirectUri)

    return res.redirect(302, target.href)
  } catch (error) {
    console.error('[domains-auth] cannot construct verification redirect URL', error)
    return res.status(500).json({ status: 'ERROR', reason: 'cannot construct verification redirect URL' })
  }
}
