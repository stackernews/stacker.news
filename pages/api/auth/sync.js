import { getServerSession } from 'next-auth/next'
import { getAuthOptions, generateRandomString } from './[...nextauth]'
import prisma from '@/api/models'

// API Endpoint for syncing a user's session to a custom domain
export default async function handler (req, res) {
  const { redirectUrl, multiAuth } = req.query
  if (!redirectUrl) {
    return res.status(400).json({ error: 'Missing redirectUrl parameter' })
  }

  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN

  // get the user's session
  const session = await getServerSession(req, res, getAuthOptions(req, res))
  if (!session) {
    // redirect to the login page, middleware will handle the rest
    return res.redirect(mainDomain + '/login?callbackUrl=' + encodeURIComponent(redirectUrl))
  }

  try {
    const token = generateRandomString()
    // create a sync token
    await prisma.verificationToken.create({
      data: {
        identifier: `sync:${session.user.id}`,
        token,
        expires: new Date(Date.now() + 1 * 60 * 1000) // 1 minute
      }
    })

    // Account Provider will handle this sync request
    const customDomainCallback = new URL('/?type=sync', redirectUrl)
    customDomainCallback.searchParams.set('token', token)
    customDomainCallback.searchParams.set('callbackUrl', redirectUrl)
    if (multiAuth) {
      customDomainCallback.searchParams.set('multiAuth', multiAuth)
    }

    // redirect to the custom domain callback
    return res.redirect(customDomainCallback.toString())
  } catch (error) {
    console.error('Error generating token:', error)
    return res.status(500).json({ error: 'Failed to generate token' })
  }
}
