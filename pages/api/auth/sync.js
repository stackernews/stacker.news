import { getServerSession } from 'next-auth/next'
import { getAuthOptions, generateRandomString } from './[...nextauth]'
import models from '@/api/models'

// API Endpoint for syncing a user's session to a custom domain
export default async function handler (req, res) {
  const { redirectUrl, multiAuth } = req.query
  if (!redirectUrl) {
    return res.status(400).json({ status: 'ERROR', reason: 'missing redirectUrl parameter' })
  }

  // redirectUrl parse
  let customDomain
  try {
    customDomain = new URL(redirectUrl)
    const domain = await models.customDomain.findUnique({ where: { domain: customDomain.host, sslState: 'verified' } })
    if (!domain) {
      return res.status(400).json({ status: 'ERROR', reason: 'custom domain not found' })
    }
  } catch (error) {
    return res.status(400).json({ status: 'ERROR', reason: 'invalid redirectUrl parameter' })
  }

  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN

  // get the user's session
  const session = await getServerSession(req, res, getAuthOptions(req, res))
  if (!session) {
    // redirect to the login page, middleware will handle the rest
    return res.redirect(mainDomain + '/login?callbackUrl=' + encodeURIComponent(redirectUrl))
  }

  try {
    const token = generateRandomString(32)
    // create a sync token
    await models.verificationToken.create({
      data: {
        identifier: `sync:${session.user.id}`,
        token,
        expires: new Date(Date.now() + 1 * 60 * 1000) // 1 minute
      }
    })

    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Set-Cookie', [
        'SameSite=Lax; Secure; HttpOnly'
      ])
    }

    // domain provider will handle this sync request
    const customDomainCallback = new URL('/?type=sync', redirectUrl)
    customDomainCallback.searchParams.set('token', token)
    customDomainCallback.searchParams.set('callbackUrl', redirectUrl)
    if (multiAuth) {
      customDomainCallback.searchParams.set('multiAuth', multiAuth)
    }

    // TODO: security headers?

    // redirect to the custom domain callback
    return res.redirect(customDomainCallback.toString())
  } catch (error) {
    console.error('Error generating token:', error)
    return res.status(500).json({ error: 'Failed to generate token' })
  }
}
