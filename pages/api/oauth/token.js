import models from '../../../api/models'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'
import rateLimit from '../../../lib/rate-limit'

const limiter = rateLimit({
  keyGenerator: (request, response) => request.ip,
  max: 20,
  windowMs: 15 * 60 * 1000 // 15 minutes
})

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await limiter(req, res)
  } catch {
    return res.status(429).json({ error: 'too_many_requests', error_description: 'Too many token requests' })
  }

  const { grant_type: grantType } = req.body

  if (grantType === 'authorization_code') {
    return await handleAuthorizationCodeGrant(req, res)
  } else if (grantType === 'refresh_token') {
    return await handleRefreshTokenGrant(req, res)
  } else {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only authorization_code and refresh_token grants are supported'
    })
  }
}

async function handleAuthorizationCodeGrant (req, res) {
  const {
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier
  } = req.body

  if (!code || !redirectUri || !clientId) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters'
    })
  }

  // Find and validate the application
  const application = await models.oAuthApplication.findFirst({
    where: {
      clientId,
      approved: true,
      suspended: false
    }
  })

  if (!application) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'Invalid client credentials'
    })
  }

  // Validate client secret for confidential clients
  if (application.isConfidential) {
    if (!clientSecret) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client secret is required'
      })
    }

    const secretValid = await bcrypt.compare(clientSecret, application.clientSecretHash)
    if (!secretValid) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      })
    }
  }

  // Find and validate the authorization code
  const authCode = await models.oAuthAuthorizationCode.findFirst({
    where: {
      code,
      applicationId: application.id,
      used: false,
      expiresAt: {
        gt: new Date()
      }
    }
  })

  if (!authCode) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Invalid or expired authorization code'
    })
  }

  // Validate redirect URI
  if (authCode.redirectUri !== redirectUri) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Redirect URI mismatch'
    })
  }

  // Validate PKCE
  if (authCode.codeChallenge) {
    if (!codeVerifier) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'code_verifier is required'
      })
    }

    let challengeValid = false
    if (authCode.codeChallengeMethod === 'S256') {
      const hash = createHash('sha256').update(codeVerifier).digest('base64url')
      challengeValid = hash === authCode.codeChallenge
    } else if (authCode.codeChallengeMethod === 'plain') {
      challengeValid = codeVerifier === authCode.codeChallenge
    }

    if (!challengeValid) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid PKCE code verifier'
      })
    }
  }

  // Mark authorization code as used
  await models.oAuthAuthorizationCode.update({
    where: { id: authCode.id },
    data: { used: true }
  })

  // Create access token and refresh token
  const accessToken = randomBytes(32).toString('hex')
  const refreshToken = randomBytes(32).toString('hex')
  const accessTokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const createdAccessToken = await models.oAuthAccessToken.create({
    data: {
      token: accessToken,
      userId: authCode.userId,
      applicationId: application.id,
      scopes: authCode.scopes,
      expiresAt: accessTokenExpiresAt
    }
  })

  await models.oAuthRefreshToken.create({
    data: {
      token: refreshToken,
      userId: authCode.userId,
      applicationId: application.id,
      accessTokenId: createdAccessToken.id,
      expiresAt: refreshTokenExpiresAt
    }
  })

  return res.status(200).json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 7200, // 2 hours in seconds
    refresh_token: refreshToken,
    scope: authCode.scopes.map(s => s.replace('_', ':')).join(' ')
  })
}

async function handleRefreshTokenGrant (req, res) {
  const { refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret } = req.body

  if (!refreshToken || !clientId) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters'
    })
  }

  // Find and validate the application
  const application = await models.oAuthApplication.findFirst({
    where: {
      clientId,
      approved: true,
      suspended: false
    }
  })

  if (!application) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'Invalid client credentials'
    })
  }

  // Validate client secret for confidential clients
  if (application.isConfidential) {
    if (!clientSecret) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client secret is required'
      })
    }

    const secretValid = await bcrypt.compare(clientSecret, application.clientSecretHash)
    if (!secretValid) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      })
    }
  }

  // Find and validate the refresh token
  const refreshTokenRecord = await models.oAuthRefreshToken.findFirst({
    where: {
      token: refreshToken,
      applicationId: application.id,
      revoked: false,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      accessToken: true
    }
  })

  if (!refreshTokenRecord) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Invalid or expired refresh token'
    })
  }

  // Revoke the old access token
  await models.oAuthAccessToken.update({
    where: { id: refreshTokenRecord.accessTokenId },
    data: { revoked: true, revokedAt: new Date() }
  })

  // Create new access token
  const newAccessToken = randomBytes(32).toString('hex')
  const accessTokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

  const createdAccessToken = await models.oAuthAccessToken.create({
    data: {
      token: newAccessToken,
      userId: refreshTokenRecord.userId,
      applicationId: application.id,
      scopes: refreshTokenRecord.accessToken.scopes,
      expiresAt: accessTokenExpiresAt
    }
  })

  // Update refresh token to point to new access token
  await models.oAuthRefreshToken.update({
    where: { id: refreshTokenRecord.id },
    data: { accessTokenId: createdAccessToken.id }
  })

  return res.status(200).json({
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: 7200, // 2 hours in seconds
    refresh_token: refreshToken, // Refresh token stays the same
    scope: refreshTokenRecord.accessToken.scopes.map(s => s.replace('_', ':')).join(' ')
  })
}
