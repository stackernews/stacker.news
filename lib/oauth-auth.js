import models from '../api/models'

export async function authenticateOAuth (req, requiredScopes = []) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Missing or invalid authorization header'
    }
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    // Find the access token
    const accessToken = await models.oAuthAccessToken.findFirst({
      where: {
        token,
        revoked: false,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailHash: true
          }
        },
        application: {
          select: {
            id: true,
            name: true,
            suspended: true,
            rateLimitRpm: true,
            rateLimitDaily: true
          }
        }
      }
    })

    if (!accessToken) {
      return {
        success: false,
        error: 'Invalid or expired access token'
      }
    }

    if (accessToken.application.suspended) {
      return {
        success: false,
        error: 'Application is suspended'
      }
    }

    // Check rate limits
    const rateLimitResult = await checkRateLimit(accessToken.applicationId, accessToken.userId)
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: rateLimitResult.reason,
        retryAfter: rateLimitResult.retryAfter
      }
    }

    // Check if the token has the required scopes
    const tokenScopes = accessToken.scopes.map(s => s.replace('_', ':'))

    for (const requiredScope of requiredScopes) {
      if (!tokenScopes.includes(requiredScope)) {
        return {
          success: false,
          error: `Insufficient scope. Required: ${requiredScopes.join(', ')}`
        }
      }
    }

    // Update last used timestamp
    await models.oAuthAccessToken.update({
      where: { id: accessToken.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: getClientIP(req)
      }
    })

    // Log API usage
    await logApiUsage(req, accessToken)

    return {
      success: true,
      user: accessToken.user,
      application: accessToken.application,
      accessToken: {
        id: accessToken.id,
        applicationId: accessToken.applicationId,
        scopes: tokenScopes
      },
      scopes: tokenScopes
    }
  } catch (error) {
    console.error('OAuth authentication error:', error)
    return {
      success: false,
      error: 'Authentication failed'
    }
  }
}

export async function checkRateLimit (applicationId, userId = null) {
  try {
    const application = await models.oAuthApplication.findUnique({
      where: { id: applicationId },
      select: {
        rateLimitRpm: true,
        rateLimitDaily: true
      }
    })

    if (!application) {
      return { allowed: false, reason: 'Application not found' }
    }

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Check RPM limit
    if (application.rateLimitRpm) {
      const recentRequests = await models.oAuthApiUsage.count({
        where: {
          applicationId,
          createdAt: {
            gte: oneMinuteAgo
          }
        }
      })

      if (recentRequests >= application.rateLimitRpm) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded (requests per minute)',
          retryAfter: 60
        }
      }
    }

    // Check daily limit
    if (application.rateLimitDaily) {
      const dailyRequests = await models.oAuthApiUsage.count({
        where: {
          applicationId,
          createdAt: {
            gte: oneDayAgo
          }
        }
      })

      if (dailyRequests >= application.rateLimitDaily) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded (daily requests)',
          retryAfter: 24 * 60 * 60
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Rate limit check error:', error)
    return { allowed: false, reason: 'Rate limit check failed' }
  }
}

async function logApiUsage (req, accessToken) {
  try {
    const endpoint = req.url.split('?')[0] // Remove query parameters
    const method = req.method
    const userAgent = req.headers['user-agent']
    const ip = getClientIP(req)

    await models.oAuthApiUsage.create({
      data: {
        applicationId: accessToken.applicationId,
        accessTokenId: accessToken.id,
        endpoint,
        method,
        statusCode: 200, // Will be updated if needed
        userId: accessToken.userId,
        ipAddress: ip,
        userAgent
      }
    })
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('API usage logging error:', error)
  }
}

function getClientIP (req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         'unknown'
}
