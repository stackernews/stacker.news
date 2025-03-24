import { getServerSession } from 'next-auth/next'
import { getAuthOptions, generateRandomString } from './[...nextauth]'
import prisma from '@/api/models'

export default async function handler (req, res) {
  const { redirectUrl, multiAuth } = req.query
  if (!redirectUrl) {
    return res.status(400).json({ error: 'Missing redirectUrl parameter' })
  }

  const session = await getServerSession(req, res, getAuthOptions(req, res))

  if (!session) {
    // TODO: redirect to login page, this goes to login overlapping other paths
    return res.redirect(redirectUrl + '/login?callbackUrl=' + encodeURIComponent(redirectUrl))
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

    const customDomainCallback = new URL('/?type=sync', redirectUrl)
    customDomainCallback.searchParams.set('token', token)
    customDomainCallback.searchParams.set('callbackUrl', redirectUrl)
    if (multiAuth) {
      customDomainCallback.searchParams.set('multiAuth', multiAuth)
    }

    return res.redirect(customDomainCallback.toString())
  } catch (error) {
    console.error('Error generating token:', error)
    return res.status(500).json({ error: 'Failed to generate token' })
  }
}
