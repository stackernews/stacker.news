import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import models from '../../../../api/models'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export default async function handler (req, res) {
  const session = await getServerSession(req, res, getAuthOptions(req))
  if (!session || !session.user?.id) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { id } = req.query
  const applicationId = parseInt(id)

  if (isNaN(applicationId)) {
    return res.status(400).json({ error: 'Invalid application ID' })
  }

  if (req.method === 'GET') {
    return await getApplication(req, res, session, applicationId)
  } else if (req.method === 'PUT') {
    return await updateApplication(req, res, session, applicationId)
  } else if (req.method === 'DELETE') {
    return await deleteApplication(req, res, session, applicationId)
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function getApplication (req, res, session, applicationId) {
  try {
    const application = await models.oAuthApplication.findFirst({
      where: {
        id: applicationId,
        userId: parseInt(session.user.id)
      },
      select: {
        id: true,
        name: true,
        description: true,
        homepageUrl: true,
        privacyPolicyUrl: true,
        termsOfServiceUrl: true,
        clientId: true,
        redirectUris: true,
        scopes: true,
        logoUrl: true,
        approved: true,
        suspended: true,
        suspendedReason: true,
        rateLimitRpm: true,
        rateLimitDaily: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            accessTokens: {
              where: {
                revoked: false,
                expiresAt: {
                  gt: new Date()
                }
              }
            },
            authorizationGrants: {
              where: {
                revoked: false
              }
            }
          }
        }
      }
    })

    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    return res.status(200).json({
      ...application,
      scopes: application.scopes.map(s => s.replace('_', ':')),
      activeTokens: application._count.accessTokens,
      authorizedUsers: application._count.authorizationGrants
    })
  } catch (error) {
    console.error('Error getting OAuth application:', error)
    return res.status(500).json({ error: 'Failed to get application' })
  }
}

async function updateApplication (req, res, session, applicationId) {
  const {
    name,
    description,
    homepageUrl,
    privacyPolicyUrl,
    termsOfServiceUrl,
    redirectUris,
    scopes,
    logoUrl,
    resetSecret
  } = req.body

  try {
    const application = await models.oAuthApplication.findFirst({
      where: {
        id: applicationId,
        userId: parseInt(session.user.id)
      }
    })

    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Validation
    const updates = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || name.length < 3 || name.length > 100) {
        return res.status(400).json({ error: 'Application name must be 3-100 characters' })
      }
      updates.name = name
    }

    if (description !== undefined) {
      updates.description = description
    }

    if (homepageUrl !== undefined) {
      updates.homepageUrl = homepageUrl
    }

    if (privacyPolicyUrl !== undefined) {
      updates.privacyPolicyUrl = privacyPolicyUrl
    }

    if (termsOfServiceUrl !== undefined) {
      updates.termsOfServiceUrl = termsOfServiceUrl
    }

    if (logoUrl !== undefined) {
      updates.logoUrl = logoUrl
    }

    if (redirectUris !== undefined) {
      if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
        return res.status(400).json({ error: 'At least one redirect URI is required' })
      }

      // Validate redirect URIs
      for (const uri of redirectUris) {
        try {
          const url = new URL(uri)
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ error: 'Redirect URIs must use HTTP or HTTPS' })
          }
        } catch {
          return res.status(400).json({ error: `Invalid redirect URI: ${uri}` })
        }
      }
      updates.redirectUris = redirectUris
    }

    if (scopes !== undefined) {
      const validScopes = [
        'read', 'write:posts', 'write:comments', 'wallet:read',
        'wallet:send', 'wallet:receive', 'profile:read', 'profile:write',
        'notifications:read', 'notifications:write'
      ]

      if (!Array.isArray(scopes) || scopes.length === 0) {
        return res.status(400).json({ error: 'At least one scope is required' })
      }

      for (const scope of scopes) {
        if (!validScopes.includes(scope)) {
          return res.status(400).json({ error: `Invalid scope: ${scope}` })
        }
      }
      updates.scopes = scopes.map(s => s.replace(':', '_'))
    }

    let newClientSecret = null
    if (resetSecret) {
      newClientSecret = randomBytes(32).toString('hex')
      updates.clientSecretHash = await bcrypt.hash(newClientSecret, 12)
    }

    const updatedApplication = await models.oAuthApplication.update({
      where: {
        id: applicationId
      },
      data: updates,
      select: {
        id: true,
        name: true,
        description: true,
        homepageUrl: true,
        privacyPolicyUrl: true,
        termsOfServiceUrl: true,
        clientId: true,
        redirectUris: true,
        scopes: true,
        logoUrl: true,
        approved: true,
        suspended: true,
        suspendedReason: true,
        rateLimitRpm: true,
        rateLimitDaily: true,
        createdAt: true,
        updatedAt: true
      }
    })

    const response = {
      ...updatedApplication,
      scopes: updatedApplication.scopes.map(s => s.replace('_', ':'))
    }

    if (newClientSecret) {
      response.clientSecret = newClientSecret
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('Error updating OAuth application:', error)
    return res.status(500).json({ error: 'Failed to update application' })
  }
}

async function deleteApplication (req, res, session, applicationId) {
  try {
    const application = await models.oAuthApplication.findFirst({
      where: {
        id: applicationId,
        userId: parseInt(session.user.id)
      }
    })

    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    await models.oAuthApplication.delete({
      where: {
        id: applicationId
      }
    })

    return res.status(204).send()
  } catch (error) {
    console.error('Error deleting OAuth application:', error)
    return res.status(500).json({ error: 'Failed to delete application' })
  }
}
