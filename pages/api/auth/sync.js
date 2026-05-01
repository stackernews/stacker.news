import models from '@/api/models'
import { randomBytes } from 'node:crypto'
import { encode as encodeJWT, getToken } from 'next-auth/jwt'
import { validateSchema, customDomainSchema } from '@/lib/validate'
import { SN_MAIN_DOMAIN, normalizeDomain } from '@/lib/domains'
import { isSafeRedirectPath } from '@/lib/url'

const SYNC_TOKEN_MAX_AGE = 60 * 5 // 5 minutes
const VERIFICATION_TOKEN_EXPIRY = 1000 * 60 * 5 // 5 minutes in milliseconds

export default async function handler (req, res) {
  try {
    if (req.method === 'POST') {
      const { verificationToken, domainName } = req.body
      if (!verificationToken || !domainName) {
        return res.status(400).json({ status: 'ERROR', reason: 'verification token and domain name are required' })
      }

      const verificationResult = await consumeVerificationToken(verificationToken)
      if (verificationResult.status === 'ERROR') {
        return res.status(400).json(verificationResult)
      }

      const sessionTokenResult = await createEphemeralSessionToken(domainName, verificationResult.userId)
      if (sessionTokenResult.status === 'ERROR') {
        return res.status(500).json(sessionTokenResult)
      }

      return res.status(200).json({ status: 'OK', sessionToken: sessionTokenResult.sessionToken })
    }

    if (req.method === 'GET') {
      const { domain, redirectUri = '/', signup } = req.query
      if (!domain || !isSafeRedirectPath(redirectUri)) {
        return res.status(400).json({ status: 'ERROR', reason: 'domain and a correct redirectUri are required' })
      }

      const domainValidation = await checkDomainValidity(domain)
      if (domainValidation.status === 'ERROR') {
        return res.status(400).json(domainValidation)
      }

      if (signup) {
        return handleNoSession(res, domain, redirectUri, signup)
      }

      const sessionToken = await getToken({ req })
      if (!sessionToken) {
        return handleNoSession(res, domain, redirectUri)
      }

      const newVerificationToken = await createVerificationToken(sessionToken)
      if (newVerificationToken.status === 'ERROR') {
        return res.status(500).json(newVerificationToken)
      }

      return redirectToDomain(res, domain, newVerificationToken.token, redirectUri)
    }
  } catch (error) {
    return res.status(500).json({ status: 'ERROR', reason: 'auth sync broke its legs' })
  }
}

async function checkDomainValidity (receivedDomain) {
  // the received domain can carry a port in local dev (e.g. pizza.com:3000);
  // the Domain row stores bare hostnames, so we always normalize before lookup.
  const { domainName } = normalizeDomain(receivedDomain)

  try {
    await validateSchema(customDomainSchema, { domainName })
    const domain = await models.domain.findUnique({
      where: { domainName, status: 'ACTIVE' }
    })

    if (!domain) {
      return { status: 'ERROR', reason: 'domain not allowed' }
    }

    return { status: 'OK' }
  } catch (error) {
    console.error('[auth sync] domain is not valid', error)
    return { status: 'ERROR', reason: 'domain is not valid' }
  }
}

function handleNoSession (res, domainName, redirectUri, signup = false) {
  const syncUrl = new URL('/api/auth/sync', SN_MAIN_DOMAIN)
  syncUrl.searchParams.set('domain', domainName)
  syncUrl.searchParams.set('redirectUri', redirectUri)

  const loginRedirectUrl = new URL(signup ? '/signup' : '/login', SN_MAIN_DOMAIN)
  if (signup) loginRedirectUrl.searchParams.set('syncSignup', 'true')
  loginRedirectUrl.searchParams.set('callbackUrl', syncUrl.href)

  res.redirect(302, loginRedirectUrl.href)
}

async function createVerificationToken (token) {
  try {
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
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const target = new URL(`${protocol}://${domainName}`)

    target.searchParams.set('sync_token', verificationToken)
    target.searchParams.set('redirectUri', redirectUri)

    res.redirect(302, target.href)
  } catch (error) {
    return { status: 'ERROR', reason: 'cannot construct the URL' }
  }
}

async function consumeVerificationToken (verificationToken) {
  try {
    const identifier = await models.$transaction(async tx => {
      const token = await tx.verificationToken.findFirst({
        where: {
          token: verificationToken,
          expires: { gt: new Date() }
        }
      })
      if (!token) throw new Error('invalid verification token')

      await tx.verificationToken.delete({ where: { id: token.id } })

      return token.identifier
    })

    return { status: 'OK', userId: Number(identifier) }
  } catch (error) {
    return { status: 'ERROR', reason: 'cannot validate verification token' }
  }
}

async function createEphemeralSessionToken (domainName, userId) {
  try {
    const domain = await models.domain.findUnique({
      where: { domainName, status: 'ACTIVE' },
      select: { id: true, tokenVersion: true }
    })
    if (!domain) {
      return { status: 'ERROR', reason: 'domain is no longer active' }
    }

    const sessionToken = await encodeJWT({
      token: {
        id: userId,
        sub: userId,
        domainName,
        domainId: domain.id,
        tokenVersion: domain.tokenVersion
      },
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: SYNC_TOKEN_MAX_AGE
    })

    return { status: 'OK', sessionToken }
  } catch (error) {
    return { status: 'ERROR', reason: 'failed to create ephemeral session token' }
  }
}
