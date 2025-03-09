import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './[...nextauth]'
import { serialize } from 'cookie'
import { datePivot } from '@/lib/time'

// TODO: dirty of previous iterations, refactor
// UNSAFE UNSAFE UNSAFE tokens are visible in the URL
export default async function handler (req, res) {
  console.log(req.query)
  if (req.query.token) {
    const session = JSON.parse(decodeURIComponent(req.query.token))
    return saveCookie(req, res, session)
  } else {
    const { redirectUrl } = req.query
    const session = await getServerSession(req, res, getAuthOptions(req))
    // TODO: use session to create a verification token
    if (session) {
      console.log('session', session)
      console.log('req.cookies', req.cookies)

      const userId = session.user.id
      const multiAuthCookieName = `multi_auth.${userId}`
      const multiAuthToken = req.cookies[multiAuthCookieName]

      if (!multiAuthToken) {
        console.error('No multi_auth token found for user', userId)
        return res.status(400).json({ error: 'No multi_auth token found' })
      }

      const transferData = {
        session,
        multiAuthToken,
        userId
      }

      // redirect back to the custom domain with the token data
      const callbackUrl = new URL('/api/auth/sync', redirectUrl)
      callbackUrl.searchParams.set('token', encodeURIComponent(JSON.stringify(transferData)))
      callbackUrl.searchParams.set('redirectUrl', req.query.redirectUrl || '/')

      return res.redirect(callbackUrl.toString())
    }
    return res.redirect(redirectUrl)
  }
}

export async function saveCookie (req, res, tokenData) {
  if (!tokenData) {
    return res.status(400).json({ error: 'Missing token' })
  }

  try {
    const secure = process.env.NODE_ENV === 'development'
    const expiresAt = datePivot(new Date(), { months: 1 })
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'lax',
      expires: expiresAt
    }
    // extract the data from the token
    const { multiAuthToken, userId } = tokenData
    console.log('Received session and multi_auth token for user', userId)

    // set the session cookie
    const sessionCookieName = secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
    // create cookies
    const sessionCookie = serialize(sessionCookieName, multiAuthToken, cookieOptions)
    // also set the multi_auth cookie on the custom domain
    const multiAuthCookie = serialize(`multi_auth.${userId}`, multiAuthToken, cookieOptions)
    // set the cookie pointer
    const pointerCookie = serialize('multi_auth.user-id', userId, cookieOptions)

    // set the cookies in the response
    res.setHeader('Set-Cookie', [sessionCookie, multiAuthCookie, pointerCookie])

    // redirect to the home page or a specified return URL
    const returnTo = req.query.redirectUrl || '/'
    return res.redirect(returnTo)
  } catch (error) {
    console.error('Error processing auth callback:', error)
    return res.status(500).json({ error: 'Failed to process authentication' })
  }
}
