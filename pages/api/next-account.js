import * as cookie from 'cookie'
import { datePivot } from '@/lib/time'
import { HTTPS, MULTI_AUTH_JWT, MULTI_AUTH_LIST, MULTI_AUTH_POINTER, SESSION_COOKIE } from '@/lib/auth'

/**
 * @param  {NextApiRequest}  req
 * @param  {NextApiResponse} res
 * @return {void}
 */
export default (req, res) => {
  // is there a cookie pointer?
  const userId = req.cookies[MULTI_AUTH_POINTER]

  // is there a session?
  const sessionJWT = req.cookies[SESSION_COOKIE]

  if (!userId && !sessionJWT) {
    // no cookie pointer and no session cookie present. nothing to do.
    res.status(404).end()
    return
  }

  const cookies = []

  const cookieOptions = {
    path: '/',
    secure: HTTPS,
    httpOnly: true,
    sameSite: 'lax',
    expires: datePivot(new Date(), { months: 1 })
  }
  // remove JWT pointed to by cookie pointer
  cookies.push(cookie.serialize(MULTI_AUTH_JWT(userId), '', { ...cookieOptions, expires: 0, maxAge: 0 }))

  // update multi_auth cookie and check if there are more accounts available
  const oldMultiAuth = req.cookies[MULTI_AUTH_LIST] ? b64Decode(req.cookies[MULTI_AUTH_LIST]) : undefined
  const newMultiAuth = oldMultiAuth?.filter(({ id }) => id !== Number(userId))
  if (!oldMultiAuth || newMultiAuth?.length === 0) {
    // no next account available. cleanup: remove multi_auth + pointer cookie
    cookies.push(cookie.serialize(MULTI_AUTH_LIST, '', { ...cookieOptions, httpOnly: false, expires: 0, maxAge: 0 }))
    cookies.push(cookie.serialize(MULTI_AUTH_POINTER, '', { ...cookieOptions, httpOnly: false, expires: 0, maxAge: 0 }))
    res.setHeader('Set-Cookie', cookies)
    res.status(204).end()
    return
  }
  cookies.push(cookie.serialize(MULTI_AUTH_LIST, b64Encode(newMultiAuth), { ...cookieOptions, httpOnly: false }))

  const newUserId = newMultiAuth[0].id
  const newUserJWT = req.cookies[MULTI_AUTH_JWT(newUserId)]
  res.setHeader('Set-Cookie', [
    ...cookies,
    cookie.serialize(MULTI_AUTH_POINTER, newUserId, { ...cookieOptions, httpOnly: false }),
    cookie.serialize(SESSION_COOKIE, newUserJWT, cookieOptions)
  ])

  res.status(302).end()
}

const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
const b64Decode = s => JSON.parse(Buffer.from(s, 'base64'))
