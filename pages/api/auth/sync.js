// SYNC sketchbook
// WIP

import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './[...nextauth]'
import models from '@/api/models'
import { encode as encodeJWT } from 'next-auth/jwt'
import { validateSchema, customDomainSchema } from '@/lib/validate'

const SN_MAIN_DOMAIN = new URL(process.env.NEXT_PUBLIC_URL)

// CD/login -> SN/sync?domain=...&redirectUri=/ LOGGED IN     -> CD/token
// CD/login -> SN/sync?domain=...&redirectUri=/ NOT LOGGED IN -> SN/login -> SN/sync?domain=...&redirectUri=/ LOGGED IN -> CD/token
export default async function handler (req, res) {
  // STEP 1: check if the domain is correct
  const { domain, redirectUri = '/' } = req.query
  if (!domain) {
    return res.status(400).json({ status: 'ERROR', reason: 'domain is a required parameter' })
  }

  // STEP 2: check if domain is valid and ACTIVE
  const domainValidation = await isDomainAllowed(domain)
  if (domainValidation.status === 'ERROR') {
    return res.status(400).json(domainValidation)
  }

  // STEP 3: check if we have a session, if not, redirect to the SN login page
  const session = await getServerSession(req, res, getAuthOptions(req, res))
  if (!session?.user) {
    return handleNoSession(req, res, domain, redirectUri)
  }

  // STEP 4: create an ephemeral session and redirect to the custom domain
  const sessionToken = await createEphemeralSession(session)
  // create url from www.pizza.com
  // ensure domain has protocol, defaulting to https
  const domainUrl = process.env.NODE_ENV === 'development' ? `http://${domain}` : `https://${domain}`
  const url = new URL(domainUrl)
  url.searchParams.set('token', encodeURIComponent(sessionToken))
  res.redirect(url.href)
}

// checks if a domain is conformative and ACTIVE
async function isDomainAllowed (domain) {
  try {
    const preparedDomain = domain.toLowerCase().trim()
    // check if domain is conformative
    await validateSchema(customDomainSchema, { domainName: preparedDomain })
    // check if domain is ACTIVE
    // not cached because we're handling sensitive data
    const domainInfo = await models.domain.findUnique({
      where: { domainName: preparedDomain, status: 'ACTIVE' }
    })
    if (!domainInfo) {
      return { status: 'ERROR', reason: 'domain not allowed' }
    }
    return { status: 'OK', domain: domainInfo }
  } catch (error) {
    return { status: 'ERROR', reason: 'domain is not valid' }
  }
}

function handleNoSession (req, res, domain, redirectUri) {
  // if we don't have a session, redirect to the login page
  const loginUrl = new URL('/login', SN_MAIN_DOMAIN)

  // sync url as callback to continue syncing afterwards
  // sync url: /api/auth/sync?domain=www.pizza.com&redirectUri=/
  const syncUrl = new URL('/api/auth/sync', SN_MAIN_DOMAIN)
  syncUrl.searchParams.set('domain', domain)
  syncUrl.searchParams.set('redirectUri', redirectUri)

  // set callbackUrl as syncUrl
  loginUrl.searchParams.set('callbackUrl', syncUrl.href)
  res.redirect(302, loginUrl.href)
}

async function createEphemeralSession (session) {
  const sessionToken = await encodeJWT({
    token: session.user,
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 60 // 1 minute, it will be refreshed later
  })
  return sessionToken
}
