import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import models from '../../../api/models'
import { randomBytes } from 'crypto'
import { URL } from 'url'

export default async function handler (req, res) {
  if (req.method === 'GET') {
    return await handleAuthorizationRequest(req, res)
  } else if (req.method === 'POST') {
    return await handleAuthorizationConsent(req, res)
  } else {
    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).json({ error: 'Method not allowed' })
  }
}

async function handleAuthorizationRequest (req, res) {
  const {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod
  } = req.query

  console.log('handleAuthorizationRequest - req.query.scope:', scope)

  // Validate required parameters
  if (responseType !== 'code') {
    return redirectWithError(res, redirectUri, 'unsupported_response_type', 'Only authorization code flow is supported', state)
  }

  if (!clientId) {
    return res.status(400).json({ error: 'client_id is required' })
  }

  if (!redirectUri) {
    return res.status(400).json({ error: 'redirect_uri is required' })
  }

  if (!scope) {
    return redirectWithError(res, redirectUri, 'invalid_scope', 'scope parameter is required', state)
  }

  // Find the application
  const application = await models.oAuthApplication.findFirst({
    where: {
      clientId,
      approved: true,
      suspended: false
    }
  })

  if (!application) {
    return redirectWithError(res, redirectUri, 'invalid_client', 'Invalid or suspended client', state)
  }

  // Validate redirect URI
  if (!application.redirectUris.includes(redirectUri)) {
    return res.status(400).json({ error: 'Invalid redirect_uri' })
  }

  // Validate scopes
  const requestedScopes = scope.split(' ')
  const validScopes = application.scopes.map(s => s.replace('_', ':'))

  for (const requestedScope of requestedScopes) {
    if (!validScopes.includes(requestedScope)) {
      return redirectWithError(res, redirectUri, 'invalid_scope', `Invalid scope: ${requestedScope}`, state)
    }
  }

  // Validate PKCE if required
  if (application.pkceRequired) {
    if (!codeChallenge) {
      return redirectWithError(res, redirectUri, 'invalid_request', 'code_challenge is required', state)
    }
    if (!codeChallengeMethod || !['S256', 'plain'].includes(codeChallengeMethod)) {
      return redirectWithError(res, redirectUri, 'invalid_request', 'invalid code_challenge_method', state)
    }
  }

  // Check if user is authenticated
  const session = await getServerSession(req, res, getAuthOptions(req))
  if (!session || !session.user?.id) {
    // Redirect to login with return URL
    const loginUrl = new URL('/login', process.env.NEXTAUTH_URL || req.headers.origin)
    loginUrl.searchParams.set('callbackUrl', req.url)
    return res.redirect(302, loginUrl.toString())
  }

  // Check if user has already authorized this application with these scopes
  const existingGrant = await models.oAuthAuthorizationGrant.findFirst({
    where: {
      userId: parseInt(session.user.id),
      applicationId: application.id,
      revoked: false
    }
  })

  const hasAllScopes = existingGrant && requestedScopes.every(scope =>
    existingGrant.scopes.map(s => s.replace('_', ':')).includes(scope)
  )

  if (hasAllScopes) {
    // Skip consent screen, create authorization code directly
    return await createAuthorizationCode(
      res,
      session.user.id,
      application,
      redirectUri,
      requestedScopes,
      state,
      codeChallenge,
      codeChallengeMethod
    )
  }

  // Redirect to consent screen
  const consentUrl = new URL('/oauth/consent', process.env.NEXTAUTH_URL || req.headers.origin)
  consentUrl.searchParams.set('client_id', clientId)
  consentUrl.searchParams.set('redirect_uri', redirectUri)
  consentUrl.searchParams.set('scope', scope)
  consentUrl.searchParams.set('state', state || '')
  if (codeChallenge) consentUrl.searchParams.set('code_challenge', codeChallenge)
  if (codeChallengeMethod) consentUrl.searchParams.set('code_challenge_method', codeChallengeMethod)

  return res.redirect(302, consentUrl.toString())
}

async function handleAuthorizationConsent (req, res) {
  const session = await getServerSession(req, res, getAuthOptions(req))
  if (!session || !session.user?.id) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    approved
  } = req.body

  if (!approved) {
    return redirectWithError(res, redirectUri, 'access_denied', 'User denied authorization', state)
  }

  // Find the application
  const application = await models.oAuthApplication.findFirst({
    where: {
      clientId,
      approved: true,
      suspended: false
    }
  })

  if (!application) {
    return redirectWithError(res, redirectUri, 'invalid_client', 'Invalid or suspended client', state)
  }

  if (typeof scope !== 'string' || !scope) {
    return res.status(400).json({ error: 'invalid_scope', error_description: 'scope parameter is required and must be a string' })
  }

  const requestedScopes = scope.split(' ')

  // Create or update authorization grant
  await models.oAuthAuthorizationGrant.upsert({
    where: {
      userId_applicationId: {
        userId: parseInt(session.user.id),
        applicationId: application.id
      }
    },
    update: {
      scopes: requestedScopes.map(s => s.replace(':', '_')),
      lastUsedAt: new Date()
    },
    create: {
      userId: parseInt(session.user.id),
      applicationId: application.id,
      scopes: requestedScopes.map(s => s.replace(':', '_'))
    }
  })

  return await createAuthorizationCode(
    res,
    session.user.id,
    application,
    redirectUri,
    requestedScopes,
    state,
    codeChallenge,
    codeChallengeMethod
  )
}

async function createAuthorizationCode (
  res,
  userId,
  application,
  redirectUri,
  scopes,
  state,
  codeChallenge,
  codeChallengeMethod
) {
  const code = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await models.oAuthAuthorizationCode.create({
    data: {
      code,
      userId: parseInt(userId),
      applicationId: application.id,
      redirectUri,
      scopes: scopes.map(s => s.replace(':', '_')),
      codeChallenge,
      codeChallengeMethod,
      expiresAt
    }
  })

  const redirectUrl = new URL(redirectUri)
  redirectUrl.searchParams.set('code', code)
  if (state) redirectUrl.searchParams.set('state', state)

  return res.redirect(302, redirectUrl.toString())
}

function redirectWithError (res, redirectUri, error, errorDescription, state) {
  if (!redirectUri) {
    return res.status(400).json({ error, error_description: errorDescription })
  }

  const redirectUrl = new URL(redirectUri)
  redirectUrl.searchParams.set('error', error)
  redirectUrl.searchParams.set('error_description', errorDescription)
  if (state) redirectUrl.searchParams.set('state', state)

  return res.redirect(302, redirectUrl.toString())
}
