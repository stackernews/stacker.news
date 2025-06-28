import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import models from '../../../api/models'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import rateLimit from '../../../lib/rate-limit'

const limiter = rateLimit({
  keyGenerator: (request, response) => request.ip,
  max: 10,
  windowMs: 15 * 60 * 1000 // 15 minutes
})

export default async function handler (req, res) {
  const session = await getServerSession(req, res, getAuthOptions(req))
  if (!session || !session.user?.id) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  if (req.method === 'POST') {
    return await createApplication(req, res, session)
  } else if (req.method === 'GET') {
    return await listApplications(req, res, session)
  } else {
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function createApplication (req, res, session) {
  try {
    await limiter(req, res)
  } catch {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const {
    name,
    description,
    homepageUrl,
    privacyPolicyUrl,
    termsOfServiceUrl,
    redirectUris,
    scopes,
    logoUrl
  } = req.body

  // Validation
  if (!name || typeof name !== 'string' || name.length < 3 || name.length > 100) {
    return res.status(400).json({ error: 'Application name is required and must be 3-100 characters' })
  }

  if (!redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
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

  // Validate scopes
  const validScopes = [
    'read', 'write:posts', 'write:comments', 'wallet:read',
    'wallet:send', 'wallet:receive', 'profile:read', 'profile:write',
    'notifications:read', 'notifications:write'
  ]

  if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return res.status(400).json({ error: 'At least one scope is required' })
  }

  for (const scope of scopes) {
    if (!validScopes.includes(scope)) {
      return res.status(400).json({ error: `Invalid scope: ${scope}` })
    }
  }

  // Generate client credentials
  const clientId = randomBytes(32).toString('hex')
  const clientSecret = randomBytes(32).toString('hex')
  const clientSecretHash = await bcrypt.hash(clientSecret, 12)

  try {
    const application = await models.oAuthApplication.create({
      data: {
        name,
        description,
        homepageUrl,
        privacyPolicyUrl,
        termsOfServiceUrl,
        clientId,
        clientSecretHash,
        redirectUris,
        scopes: scopes.map(s => s.replace(':', '_')),
        logoUrl,
        userId: parseInt(session.user.id),
        isConfidential: true,
        pkceRequired: true
      }
    })

    return res.status(201).json({
      id: application.id,
      name: application.name,
      description: application.description,
      homepageUrl: application.homepageUrl,
      privacyPolicyUrl: application.privacyPolicyUrl,
      termsOfServiceUrl: application.termsOfServiceUrl,
      clientId: application.clientId,
      clientSecret, // Only returned once during creation
      redirectUris: application.redirectUris,
      scopes: application.scopes.map(s => s.replace('_', ':')), // Convert back to API format
      logoUrl: application.logoUrl,
      approved: application.approved,
      createdAt: application.createdAt
    })
  } catch (error) {
    console.error('Error creating OAuth application:', error)
    return res.status(500).json({ error: 'Failed to create application' })
  }
}

async function listApplications (req, res, session) {
  try {
    const applications = await models.oAuthApplication.findMany({
      where: {
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
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json(
      applications.map(app => ({
        ...app,
        scopes: app.scopes.map(s => s.replace('_', ':')) // Convert back to API format
      }))
    )
  } catch (error) {
    console.error('Error listing OAuth applications:', error)
    return res.status(500).json({ error: 'Failed to list applications' })
  }
}
