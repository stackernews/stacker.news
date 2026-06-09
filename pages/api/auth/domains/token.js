import models from '@/api/models'
import { parseSafeHost } from '@/lib/safe-url'
import { deriveChallenge, isValidHex64, safeEqual } from '@/lib/domains/auth'
import { encode as encodeJWT } from 'next-auth/jwt'

/**
 * Latest step of the custom domain auth flow
 * called with POST by /api/auth/domains/verify to exchange the code for a session token
 *
 * Compares code+hashed_verifier against the DB stored code+challenge,
 * if they match, creates a JWT and returns it to /api/auth/domains/verify to set the session cookie and multi-auth cookies.
 */
export default async function handler (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', reason: 'method not allowed' })
  }

  try {
    const { code, domainName, verifier } = req.body
    const parsedDomain = parseSafeHost(domainName)
    if (!isValidHex64(code) || !parsedDomain || !isValidHex64(verifier)) {
      return res.status(400).json({ status: 'ERROR', reason: 'valid code, domainName, and verifier are required' })
    }

    // hash the verifier to get the challenge
    const challenge = deriveChallenge(verifier)
    // consume the verification code, comparing the challenge and code to the stored values
    const verificationResult = await consumeVerificationCode(parsedDomain.hostname, code, challenge)
    if (!verificationResult) {
      return res.status(400).json({ status: 'ERROR', reason: 'cannot consume verification code' })
    }

    // create a session token
    const sessionToken = await createSessionToken({
      userId: verificationResult.userId,
      domainName: parsedDomain.hostname,
      domainId: verificationResult.domainId,
      tokenVersion: verificationResult.tokenVersion
    })
    if (!sessionToken) {
      return res.status(500).json({ status: 'ERROR', reason: 'cannot create session token' })
    }

    // forward display fields so the proxy can populate the multi-auth list
    // cookie on the custom domain (the picker reads name/photoId from that list).
    return res.status(200).json({
      status: 'OK',
      sessionToken,
      user: verificationResult.user
    })
  } catch (error) {
    console.error('[domains-auth] cannot exchange code for a session token', error)
    return res.status(500).json({ status: 'ERROR', reason: 'failed to exchange code for a session token' })
  }
}

async function consumeVerificationCode (domainName, code, challenge) {
  try {
    const result = await models.$transaction(async tx => {
      // lock the Domain row in order to avoid minting a session against a stale tokenVersion.
      const domains = await tx.$queryRaw`
        SELECT id, "tokenVersion"
        FROM "Domain"
        WHERE "domainName" = ${domainName}
          AND status = 'ACTIVE'
        FOR UPDATE
      `
      const domain = domains[0]
      if (!domain) throw new Error('domain not allowed')

      const verificationCode = await tx.domainAuthRequest.findUnique({
        where: { code, expiresAt: { gt: new Date() } }
      })
      if (!verificationCode) throw new Error('invalid verification code')
      if (!safeEqual(verificationCode.challenge, challenge)) throw new Error('invalid verification challenge')

      const sameDomain = Number(verificationCode.domainId) === Number(domain.id)
      if (!sameDomain) throw new Error('code domain mismatch')

      // seed MULTI_AUTH_LIST with user data
      const userId = Number(verificationCode.userId)
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, photoId: true }
      })
      if (!user) throw new Error('user not found')

      await tx.domainAuthRequest.delete({ where: { id: verificationCode.id } })

      return {
        userId,
        domainId: domain.id,
        tokenVersion: domain.tokenVersion,
        user
      }
    })

    return result
  } catch (error) {
    console.error('[domains-auth] cannot consume verification code', error)
    return null
  }
}

async function createSessionToken ({ userId, domainName, domainId, tokenVersion }) {
  try {
    const sessionToken = await encodeJWT({
      token: {
        id: userId,
        sub: userId,
        domainName,
        domainId,
        tokenVersion
      },
      secret: process.env.NEXTAUTH_SECRET
    })

    return sessionToken
  } catch (error) {
    console.error('[domains-auth] cannot create session token', error)
    return null
  }
}
