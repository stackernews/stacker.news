import models from '@/api/models'
import { randomBytes } from 'node:crypto'
import { encode as encodeJWT, getToken } from 'next-auth/jwt'
import { validateSchema, customDomainSchema } from '@/lib/validate'
import { SN_MAIN_DOMAIN } from '@/lib/domains'
import { formatHost, parseSafeHost, safeRedirectPath } from '@/lib/safe-url'
import { VERIFICATION_TOKEN_EXPIRY_MS, AUTH_SYNC_TOKEN_TAG } from '@/lib/constants'
import { multiAuthMiddleware } from '@/lib/auth'

export default async function handler (req, res) {
  try {
    if (req.method === 'POST') {
      const { verificationToken, domainName } = req.body
      const parsedDomain = parseSafeHost(domainName)
      if (!verificationToken || !parsedDomain) {
        return res.status(400).json({ status: 'ERROR', reason: 'verification token and domain name are required' })
      }

      const domainValidation = await checkDomainValidity(parsedDomain.hostname)
      if (domainValidation.status === 'ERROR') {
        return res.status(400).json(domainValidation)
      }

      const verificationResult = await consumeVerificationToken(verificationToken, domainValidation.domainId)
      if (verificationResult.status === 'ERROR') {
        return res.status(400).json(verificationResult)
      }

      const sessionTokenResult = await createSessionToken(parsedDomain.hostname, verificationResult.userId)
      if (sessionTokenResult.status === 'ERROR') {
        return res.status(500).json(sessionTokenResult)
      }

      return res.status(200).json({ status: 'OK', sessionToken: sessionTokenResult.sessionToken })
    }

    if (req.method === 'GET') {
      const { domain, redirectUri: rawRedirectUri, signup } = req.query
      const parsedDomain = parseSafeHost(domain)
      if (!parsedDomain) {
        return res.status(400).json({ status: 'ERROR', reason: 'domain is required' })
      }

      const domainValidation = await checkDomainValidity(parsedDomain.hostname)
      if (domainValidation.status === 'ERROR') {
        return res.status(400).json(domainValidation)
      }

      const canonicalDomain = formatHost(parsedDomain)
      const redirectUri = safeRedirectPath(rawRedirectUri, canonicalDomain)
      if (signup) {
        return handleNoSession(res, canonicalDomain, redirectUri, signup)
      }

      // honor multi auth cookie
      req = await multiAuthMiddleware(req, res)
      const sessionToken = await getToken({ req })
      if (!sessionToken) {
        return handleNoSession(res, canonicalDomain, redirectUri)
      }

      const newVerificationToken = await createVerificationToken(sessionToken, domainValidation.domainId)
      if (newVerificationToken.status === 'ERROR') {
        return res.status(500).json(newVerificationToken)
      }

      return redirectToDomain(res, parsedDomain, newVerificationToken.token, redirectUri)
    }
  } catch (error) {
    return res.status(500).json({ status: 'ERROR', reason: 'auth sync broke its legs' })
  }
}

async function checkDomainValidity (receivedDomain) {
  try {
    await validateSchema(customDomainSchema, { domainName: receivedDomain })
    const domain = await models.domain.findUnique({
      where: { domainName: receivedDomain, status: 'ACTIVE' },
      select: { id: true }
    })

    if (!domain) {
      return { status: 'ERROR', reason: 'domain not allowed' }
    }

    return { status: 'OK', domainId: domain.id }
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
  loginRedirectUrl.searchParams.set('domain', domainName)
  loginRedirectUrl.searchParams.set('callbackUrl', syncUrl.href)

  res.redirect(302, loginRedirectUrl.href)
}

async function createVerificationToken (token, domainId) {
  try {
    const verificationToken = await models.verificationToken.create({
      data: {
        // bind the token to the domain it was created for
        identifier: `${AUTH_SYNC_TOKEN_TAG}:${token.id}:${domainId}`,
        token: randomBytes(32).toString('hex'),
        expires: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS)
      }
    })
    return { status: 'OK', token: verificationToken.token }
  } catch (error) {
    return { status: 'ERROR', reason: 'failed to create verification token' }
  }
}

function redirectToDomain (res, domain, verificationToken, redirectUri) {
  try {
    const target = new URL(`${SN_MAIN_DOMAIN.protocol}//${formatHost(domain)}`)

    target.searchParams.set('sync_token', verificationToken)
    target.searchParams.set('redirectUri', redirectUri)

    return res.redirect(302, target.href)
  } catch (error) {
    console.error('[auth sync] cannot construct redirect URL', error)
    return res.status(500).json({ status: 'ERROR', reason: 'cannot construct the URL' })
  }
}

async function consumeVerificationToken (verificationToken, expectedDomainId) {
  try {
    const userId = await models.$transaction(async tx => {
      const token = await tx.verificationToken.findFirst({
        where: {
          token: verificationToken,
          expires: { gt: new Date() }
        }
      })
      if (!token) throw new Error('invalid verification token')

      const identifier = token.identifier || ''

      const [tag, userIdStr, domainIdStr] = identifier.split(':')
      if (tag !== AUTH_SYNC_TOKEN_TAG || Number(domainIdStr) !== expectedDomainId) {
        throw new Error('invalid verification token domain')
      }

      await tx.verificationToken.delete({ where: { id: token.id } })

      return Number(userIdStr)
    })

    return { status: 'OK', userId }
  } catch (error) {
    return { status: 'ERROR', reason: 'cannot validate verification token' }
  }
}

async function createSessionToken (domainName, userId) {
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
      secret: process.env.NEXTAUTH_SECRET
    })

    return { status: 'OK', sessionToken }
  } catch (error) {
    return { status: 'ERROR', reason: 'failed to create ephemeral session token' }
  }
}
