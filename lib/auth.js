import { datePivot } from '@/lib/time'
import * as cookie from 'cookie'
import { NodeNextRequest } from 'next/dist/server/base-http/node'
import { encode as encodeJWT, decode as decodeJWT } from 'next-auth/jwt'

const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
const b64Decode = s => JSON.parse(Buffer.from(s, 'base64'))

const userJwtRegexp = /^multi_auth\.\d+$/

const HTTPS = process.env.NODE_ENV === 'production'
const SESSION_COOKIE_NAME = HTTPS ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

const cookieOptions = (args) => ({
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  // httpOnly cookies by default
  httpOnly: true,
  sameSite: 'lax',
  // default expiration for next-auth JWTs is in 1 month
  expires: datePivot(new Date(), { months: 1 }),
  ...args
})

export function setMultiAuthCookies (req, res, { id, jwt, name, photoId }) {
  const httpOnlyOptions = cookieOptions()
  const jsOptions = { ...httpOnlyOptions, httpOnly: false }

  // add JWT to **httpOnly** cookie
  res.appendHeader('Set-Cookie', cookie.serialize(`multi_auth.${id}`, jwt, httpOnlyOptions))

  // switch to user we just added
  res.appendHeader('Set-Cookie', cookie.serialize('multi_auth.user-id', id, jsOptions))

  let newMultiAuth = [{ id, name, photoId }]
  if (req.cookies.multi_auth) {
    const oldMultiAuth = b64Decode(req.cookies.multi_auth)
    // make sure we don't add duplicates
    if (oldMultiAuth.some(({ id: id_ }) => id_ === id)) return
    newMultiAuth = [...oldMultiAuth, ...newMultiAuth]
  }
  res.appendHeader('Set-Cookie', cookie.serialize('multi_auth', b64Encode(newMultiAuth), jsOptions))
}

export function switchSessionCookie (request) {
  // switch next-auth session cookie with multi_auth cookie if cookie pointer present

  // is there a cookie pointer?
  const cookiePointerName = 'multi_auth.user-id'
  const hasCookiePointer = !!request.cookies[cookiePointerName]

  // is there a session?
  const hasSession = !!request.cookies[SESSION_COOKIE_NAME]

  if (!hasCookiePointer || !hasSession) {
    // no session or no cookie pointer. do nothing.
    return request
  }

  const userId = request.cookies[cookiePointerName]
  if (userId === 'anonymous') {
    // user switched to anon. only delete session cookie.
    delete request.cookies[SESSION_COOKIE_NAME]
    return request
  }

  const userJWT = request.cookies[`multi_auth.${userId}`]
  if (!userJWT) {
    // no JWT for account switching found
    return request
  }

  if (userJWT) {
    // use JWT found in cookie pointed to by cookie pointer
    request.cookies[SESSION_COOKIE_NAME] = userJWT
    return request
  }

  return request
}

export function checkMultiAuthCookies (req, res) {
  if (!req.cookies.multi_auth || !req.cookies['multi_auth.user-id']) {
    return false
  }

  const accounts = b64Decode(req.cookies.multi_auth)
  for (const account of accounts) {
    if (!req.cookies[`multi_auth.${account.id}`]) {
      return false
    }
  }

  return true
}

export function resetMultiAuthCookies (req, res) {
  const httpOnlyOptions = cookieOptions({ expires: 0, maxAge: 0 })
  const jsOptions = { ...httpOnlyOptions, httpOnly: false }

  if ('multi_auth' in req.cookies) res.appendHeader('Set-Cookie', cookie.serialize('multi_auth', '', jsOptions))
  if ('multi_auth.user-id' in req.cookies) res.appendHeader('Set-Cookie', cookie.serialize('multi_auth.user-id', '', jsOptions))

  for (const key of Object.keys(req.cookies)) {
    // reset all user JWTs
    if (userJwtRegexp.test(key)) {
      res.appendHeader('Set-Cookie', cookie.serialize(key, '', httpOnlyOptions))
    }
  }
}

export async function refreshMultiAuthCookies (req, res) {
  const httpOnlyOptions = cookieOptions()
  const jsOptions = { ...httpOnlyOptions, httpOnly: false }

  const refreshCookie = (name) => {
    res.appendHeader('Set-Cookie', cookie.serialize(name, req.cookies[name], jsOptions))
  }

  const refreshToken = async (token) => {
    const secret = process.env.NEXTAUTH_SECRET
    return await encodeJWT({
      token: await decodeJWT({ token, secret }),
      secret
    })
  }

  for (const [key, value] of Object.entries(req.cookies)) {
    if (!key.startsWith('multi_auth') && key !== SESSION_COOKIE_NAME) continue

    if (userJwtRegexp.test(key) || key === SESSION_COOKIE_NAME) {
      const oldToken = value
      const newToken = await refreshToken(oldToken)
      res.appendHeader('Set-Cookie', cookie.serialize(key, newToken, httpOnlyOptions))
      continue
    }

    refreshCookie(key)
  }
}

export async function multiAuthMiddleware (req, res) {
  if (!req.cookies) {
    // required to properly access parsed cookies via req.cookies and not unparsed via req.headers.cookie
    req = new NodeNextRequest(req)
  }

  const ok = checkMultiAuthCookies(req, res)
  if (!ok) {
    resetMultiAuthCookies(req, res)
    return switchSessionCookie(req)
  }

  await refreshMultiAuthCookies(req, res)
  return switchSessionCookie(req)
}
