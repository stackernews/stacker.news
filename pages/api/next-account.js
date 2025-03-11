import * as cookie from 'cookie'
import { datePivot } from '@/lib/time'

/**
 * @param  {NextApiRequest}  req
 * @param  {NextApiResponse} res
 * @return {void}
 */
export default (req, res) => {
  // is there a cookie pointer?
  const cookiePointerName = 'multi_auth.user-id'
  const userId = req.cookies[cookiePointerName]

  const secure = process.env.NODE_ENV === 'production'

  // is there a session?
  const sessionCookieName = secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
  const sessionJWT = req.cookies[sessionCookieName]

  if (!userId && !sessionJWT) {
    // no cookie pointer and no session cookie present. nothing to do.
    res.status(404).end()
    return
  }

  const cookies = []

  const cookieOptions = {
    path: '/',
    secure,
    httpOnly: true,
    sameSite: 'lax',
    expires: datePivot(new Date(), { months: 1 })
  }
  // remove JWT pointed to by cookie pointer
  cookies.push(cookie.serialize(`multi_auth.${userId}`, '', { ...cookieOptions, expires: 0, maxAge: 0 }))

  // update multi_auth cookie and check if there are more accounts available
  const oldMultiAuth = req.cookies.multi_auth ? b64Decode(req.cookies.multi_auth) : undefined
  const newMultiAuth = oldMultiAuth?.filter(({ id }) => id !== Number(userId))
  if (!oldMultiAuth || newMultiAuth?.length === 0) {
    // no next account available. cleanup: remove multi_auth + pointer cookie
    cookies.push(cookie.serialize('multi_auth', '', { ...cookieOptions, httpOnly: false, expires: 0, maxAge: 0 }))
    cookies.push(cookie.serialize('multi_auth.user-id', '', { ...cookieOptions, httpOnly: false, expires: 0, maxAge: 0 }))
    res.setHeader('Set-Cookie', cookies)
    res.status(204).end()
    return
  }
  cookies.push(cookie.serialize('multi_auth', b64Encode(newMultiAuth), { ...cookieOptions, httpOnly: false }))

  const newUserId = newMultiAuth[0].id
  const newUserJWT = req.cookies[`multi_auth.${newUserId}`]
  res.setHeader('Set-Cookie', [
    ...cookies,
    cookie.serialize(cookiePointerName, newUserId, { ...cookieOptions, httpOnly: false }),
    cookie.serialize(sessionCookieName, newUserJWT, cookieOptions)
  ])

  res.status(302).end()
}

const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
const b64Decode = s => JSON.parse(Buffer.from(s, 'base64'))
