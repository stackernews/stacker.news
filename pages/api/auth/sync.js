// SYNC sketchbook
// WIP

import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './[...nextauth]'
import models from '@/api/models'
import { encode as encodeJWT } from 'next-auth/jwt'

const SN_MAIN_DOMAIN = new URL(process.env.NEXT_PUBLIC_URL)

// CD/login -> SN/sync?domain=...&redirectUri=/ LOGGED IN     -> CD/token
// CD/login -> SN/sync?domain=...&redirectUri=/ NOT LOGGED IN -> SN/login -> SN/sync?domain=...&redirectUri=/ LOGGED IN -> CD/token
export default async function handler (req, res) {
  // STEP 1: check if the domain is correct
  const domain = req.query.domain
  if (!domain) {
    res.status(400).json({ status: 'ERROR', reason: 'invalid domain parameter' })
    return
  }

  // STEP 2: check if we allowed this domain to sync
  const domainCheck = await isDomainAllowed(domain)
  if (domainCheck.status === 'ERROR') {
    res.status(400).json(domainCheck)
    return
  }

  // STEP 3: check if we have a session, if not, redirect to the SN login page
  const session = await getServerSession(req, res, getAuthOptions(req, res))
  if (!session) {
    // if we don't have a session, redirect to the login page
    const loginUrl = new URL('/login', SN_MAIN_DOMAIN)

    // sync url as callback to continue syncing afterwards
    // sync url: /api/auth/sync?domain=www.pizza.com&redirectUri=/
    const syncUrl = `/api/auth/sync?domain=${encodeURIComponent(domain)}&redirectUri=${encodeURIComponent(req.query.redirectUri || '/')}`

    loginUrl.searchParams.set('callbackUrl', encodeURIComponent(syncUrl))
    res.redirect(loginUrl.href)
    return
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

async function isDomainAllowed (domain) {
  try {
    // not cached because we're handling sensitive data
    const domainInfo = await models.domain.findUnique({
      where: { domainName: domain, status: 'ACTIVE' }
    })
    if (!domainInfo) {
      return { status: 'ERROR', reason: 'custom domain not found' }
    }
    return { status: 'OK', domain: domainInfo }
  } catch (error) {
    return { status: 'ERROR', reason: 'invalid redirectUri parameter' }
  }
}

async function createEphemeralSession (session) {
  const sessionToken = await encodeJWT({
    token: session.user,
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 60 // 1 minute, it will be refreshed later
  })
  return sessionToken
}
