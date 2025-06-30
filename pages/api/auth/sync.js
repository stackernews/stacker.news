// Auth Sync API
import models from '@/api/models'
import { randomBytes } from 'node:crypto'
import { encode as encodeJWT, getToken } from 'next-auth/jwt'
import { validateSchema, customDomainSchema } from '@/lib/validate'

const SN_MAIN_DOMAIN = new URL(process.env.NEXT_PUBLIC_URL)
const SYNC_TOKEN_MAX_AGE = 60 * 5 // 5 minutes
const VERIFICATION_TOKEN_EXPIRY = 1000 * 60 * 5 // 5 minutes in milliseconds

export default async function handler (req, res) {
  try {
    // POST /api/auth/sync
    // exchange a verification token for an ephemeral session token
    if (req.method === 'POST') {
      const { verificationToken } = req.body
      if (!verificationToken) {
        return res.status(400).json({ status: 'ERROR', reason: 'verification token is required' })
      }

      // validate and consume the verification token
      const verificationResult = await consumeVerificationToken(verificationToken)
      if (verificationResult.status === 'ERROR') {
        return res.status(400).json(verificationResult)
      }

      // create a short-lived JWT session token with the user id
      const sessionTokenResult = await createEphemeralSessionToken(verificationResult.userId)
      if (sessionTokenResult.status === 'ERROR') {
        // if we can't create a session token, return the error
        return res.status(500).json(sessionTokenResult)
      }

      // return the session token
      return res.status(200).json({ status: 'OK', sessionToken: sessionTokenResult.sessionToken })
    }

    // GET /api/auth/sync
    // check if there's a session, if not, redirect to the SN login page and come back here
    // if there's a session, create a verification token and redirect to the domain
    if (req.method === 'GET') {
      // STEP 1: check if the domain is correct
      const { domain, redirectUri, signup } = req.query
      // domain and a path redirectUri are required
      if (!domain || !redirectUri?.startsWith('/')) {
        return res.status(400).json({ status: 'ERROR', reason: 'domain and a correct redirectUri are required' })
      }

      // STEP 2: check if domain is valid and ACTIVE
      const domainValidation = await checkDomainValidity(domain)
      if (domainValidation.status === 'ERROR') {
        return res.status(400).json(domainValidation)
      }

      // if we're signing up, redirect to the SN signup page and come back here
      if (signup) {
        return handleNoSession(res, domain, redirectUri, signup)
      }

      // STEP 3: check if we have a session, if not, redirect to the SN login page
      const sessionToken = await getToken({ req }) // from cookie
      if (!sessionToken) {
        // we don't have a session, redirect to the login page and come back here
        return handleNoSession(res, domain, redirectUri)
      }

      // STEP 4: create a verification token
      const newVerificationToken = await createVerificationToken(sessionToken)
      if (newVerificationToken.status === 'ERROR') {
        return res.status(500).json(newVerificationToken)
      }

      // STEP 5: redirect to the domain with the verification token
      return redirectToDomain(res, domain, newVerificationToken.token, redirectUri)
    }
  } catch (error) {
    return res.status(500).json({ status: 'ERROR', reason: 'auth sync broke its legs' })
  }
}

// checks if a domain is conformant and ACTIVE
async function checkDomainValidity (domainName) {
  try {
    // check if domain is conformant
    await validateSchema(customDomainSchema, { domainName })
    // check if domain is ACTIVE
    const domain = await models.domain.findUnique({
      where: { domainName, status: 'ACTIVE' }
    })

    if (!domain) {
      return { status: 'ERROR', reason: 'domain not allowed' }
    }

    // domain is valid and ACTIVE
    return { status: 'OK' }
  } catch (error) {
    return { status: 'ERROR', reason: 'domain is not valid' }
  }
}

function handleNoSession (res, domainName, redirectUri, signup = false) {
  // create the sync callback URL that we'll return to after login
  const syncUrl = new URL('/api/auth/sync', SN_MAIN_DOMAIN)
  syncUrl.searchParams.set('domain', domainName)
  syncUrl.searchParams.set('redirectUri', redirectUri)

  // create SN login URL and add our sync callback URL
  const loginRedirectUrl = new URL(signup ? '/signup' : '/login', SN_MAIN_DOMAIN)
  if (signup) loginRedirectUrl.searchParams.set('syncSignup', 'true')
  loginRedirectUrl.searchParams.set('callbackUrl', syncUrl.href)

  // redirect user to login page
  res.redirect(302, loginRedirectUrl.href)
}

async function createVerificationToken (token) {
  try {
    // a 5 minutes verification token using the session token's user id
    const verificationToken = await models.verificationToken.create({
      data: {
        identifier: token.id.toString(),
        token: randomBytes(32).toString('hex'),
        expires: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY)
      }
    })
    return { status: 'OK', token: verificationToken.token }
  } catch (error) {
    return { status: 'ERROR', reason: 'failed to create verification token' }
  }
}

async function redirectToDomain (res, domainName, verificationToken, redirectUri) {
  try {
    // create the target URL
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const target = new URL(`${protocol}://${domainName}`)

    // add the verification token and the redirectUri to the URL
    target.searchParams.set('sync_token', verificationToken)
    target.searchParams.set('redirectUri', redirectUri)

    // redirect to the custom domain
    res.redirect(302, target.href)
  } catch (error) {
    return { status: 'ERROR', reason: 'cannot construct the URL' }
  }
}

async function consumeVerificationToken (verificationToken) {
  try {
    // find the verification token
    const identifier = await models.$transaction(async tx => {
      const token = await tx.verificationToken.findFirst({
        where: {
          token: verificationToken,
          expires: { gt: new Date() }
        }
      })
      if (!token) throw new Error('invalid verification token')

      // anyway we touched this token, we can delete it
      await tx.verificationToken.delete({ where: { id: token.id } })

      return token.identifier
    })

    // return the user id
    return { status: 'OK', userId: Number(identifier) }
  } catch (error) {
    return { status: 'ERROR', reason: 'cannot validate verification token' }
  }
}

async function createEphemeralSessionToken (userId) {
  try {
    // create a short-lived JWT session token with the user id
    const sessionToken = await encodeJWT({
      token: { id: userId, sub: userId },
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: SYNC_TOKEN_MAX_AGE
    })

    // return the ephemeral session token
    return { status: 'OK', sessionToken }
  } catch (error) {
    return { status: 'ERROR', reason: 'failed to create ephemeral session token' }
  }
}
