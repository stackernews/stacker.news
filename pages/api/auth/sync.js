// SYNC sketchbook
// WIP

import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './[...nextauth]'
import models from '@/api/models'
import { encode as encodeJWT } from 'next-auth/jwt'
import { validateSchema, customDomainSchema } from '@/lib/validate'

const SN_MAIN_DOMAIN = new URL(process.env.NEXT_PUBLIC_URL)
const SYNC_TOKEN_MAX_AGE = 60 // 1 minute

// CD/login -> SN/sync?domain=...&redirectUri=/ LOGGED IN     -> CD/token
// CD/login -> SN/sync?domain=...&redirectUri=/ NOT LOGGED IN -> SN/login -> SN/sync?domain=...&redirectUri=/ LOGGED IN -> CD/token
export default async function handler (req, res) {
  try {
    // STEP 1: check if the domain is correct
    const { domain, redirectUri = '/' } = req.query
    if (!domain) {
      return res.status(400).json({ status: 'ERROR', reason: 'domain is a required parameter' })
    }

    // prepare domain
    const domainName = domain.toLowerCase().trim()

    // STEP 2: check if domain is valid and ACTIVE
    const domainValidation = await isDomainAllowed(domainName)
    if (domainValidation.status === 'ERROR') {
      return res.status(400).json(domainValidation)
    }

    // STEP 3: check if we have a session, if not, redirect to the SN login page
    const session = await getServerSession(req, res, getAuthOptions(req, res))
    if (!session?.user) {
      return handleNoSession(res, domainName, redirectUri)
    }

    // STEP 4: create an ephemeral session and redirect to the custom domain
    const sessionToken = await createEphemeralSessionToken(session, domainName)
    if (sessionToken.status === 'ERROR') {
      return res.status(500).json(sessionToken)
    }

    return redirectToDomain(res, domainName, sessionToken, redirectUri)
  } catch (error) {
    return res.status(500).json({ status: 'ERROR', reason: 'auth sync broke its legs' })
  }
}

// checks if a domain is conformative and ACTIVE
async function isDomainAllowed (domainName) {
  try {
    // check if domain is conformative
    await validateSchema(customDomainSchema, { domainName })
    // check if domain is ACTIVE
    // not cached because we're handling sensitive data
    const domainInfo = await models.domain.findUnique({
      where: { domainName, status: 'ACTIVE' }
    })
    if (!domainInfo) {
      return { status: 'ERROR', reason: 'domain not allowed' }
    }
    return { status: 'OK', domain: domainInfo }
  } catch (error) {
    return { status: 'ERROR', reason: 'domain is not valid' }
  }
}

function handleNoSession (res, domainName, redirectUri) {
  // if we don't have a session, redirect to the login page
  const loginUrl = new URL('/login', SN_MAIN_DOMAIN)

  // sync url as callback to continue syncing afterwards
  // sync url: /api/auth/sync?domain=www.pizza.com&redirectUri=/
  const syncUrl = new URL('/api/auth/sync', SN_MAIN_DOMAIN)
  syncUrl.searchParams.set('domain', domainName)
  syncUrl.searchParams.set('redirectUri', redirectUri)

  // set callbackUrl as syncUrl
  loginUrl.searchParams.set('callbackUrl', syncUrl.href)
  res.redirect(302, loginUrl.href)
}

// creates an ephemeral session token for the user
async function createEphemeralSessionToken (session, domainName) {
  try {
    const domainTiedPayload = {
      ...session.user,
      domainName,
      purpose: 'auth_sync'
    }
    const sessionToken = await encodeJWT({
      token: domainTiedPayload,
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: SYNC_TOKEN_MAX_AGE
    })
    return sessionToken
  } catch (error) {
    return { status: 'ERROR', reason: 'failed to create ephemeral session token' }
  }
}

async function redirectToDomain (res, domainName, token, redirectUri) {
  try {
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const target = new URL(`${protocol}://${domainName}`)

    target.searchParams.set('token', token)
    // if redirectUri is provided, add it to the URL
    if (redirectUri && redirectUri !== '/') {
      target.searchParams.set('redirectUri', redirectUri)
    }

    res.redirect(302, target.href)
  } catch (error) {
    console.error('[authSync::redirectToDomain] error', error)
    return { status: 'ERROR', reason: 'could not construct the URL' }
  }
}
