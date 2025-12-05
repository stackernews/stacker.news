import { datePivot } from '@/lib/time'
import * as cookie from 'cookie'
import { NodeNextRequest } from 'next/dist/server/base-http/node'
import { encode as encodeJWT, decode as decodeJWT } from 'next-auth/jwt'

const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
const b64Decode = s => JSON.parse(Buffer.from(s, 'base64'))

export const HTTPS = process.env.NODE_ENV === 'production'

const secureCookie = (name) =>
  HTTPS
    ? `__Secure-${name}`
    : name

export const SESSION_COOKIE = secureCookie('next-auth.session-token')
export const MULTI_AUTH_LIST = secureCookie('multi_auth')
export const MULTI_AUTH_POINTER = secureCookie('multi_auth.user-id')
export const MULTI_AUTH_ANON = 'anonymous'

export const MULTI_AUTH_JWT = id => secureCookie(`multi_auth.${id}`)

const MULTI_AUTH_REGEXP = /^(__Secure-)?multi_auth/
const MULTI_AUTH_JWT_REGEXP = /^(__Secure-)?multi_auth\.\d+$/

export const cookieOptions = (args) => ({
  path: '/',
  secure: HTTPS,
  // httpOnly cookies by default
  httpOnly: true,
  sameSite: 'lax',
  // default expiration for next-auth JWTs is in 30 days
  expires: datePivot(new Date(), { days: 30 }),
  maxAge: 2592000, // 30 days in seconds
  ...args
})

export function setMultiAuthCookies (req, res, { id, jwt, name, photoId }) {
  const httpOnlyOptions = cookieOptions()
  const jsOptions = { ...httpOnlyOptions, httpOnly: false }

  // add JWT to **httpOnly** cookie
  res.appendHeader('Set-Cookie', cookie.serialize(MULTI_AUTH_JWT(id), jwt, httpOnlyOptions))

  // switch to user we just added
  res.appendHeader('Set-Cookie', cookie.serialize(MULTI_AUTH_POINTER, id, jsOptions))

  let newMultiAuth = [{ id, name, photoId }]
  if (req.cookies[MULTI_AUTH_LIST]) {
    const oldMultiAuth = b64Decode(req.cookies[MULTI_AUTH_LIST])
    // make sure we don't add duplicates
    if (oldMultiAuth.some(({ id: id_ }) => id_ === id)) return
    newMultiAuth = [...oldMultiAuth, ...newMultiAuth]
  }
  res.appendHeader('Set-Cookie', cookie.serialize(MULTI_AUTH_LIST, b64Encode(newMultiAuth), jsOptions))
}

function switchSessionCookie (request) {
  // switch next-auth session cookie with multi_auth cookie if cookie pointer present

  // is there a cookie pointer?
  const hasCookiePointer = !!request.cookies[MULTI_AUTH_POINTER]

  // is there a session?
  const hasSession = !!request.cookies[SESSION_COOKIE]

  if (!hasCookiePointer || !hasSession) {
    // no session or no cookie pointer. do nothing.
    return request
  }

  const userId = request.cookies[MULTI_AUTH_POINTER]
  if (userId === MULTI_AUTH_ANON) {
    // user switched to anon. only delete session cookie.
    delete request.cookies[SESSION_COOKIE]
    return request
  }

  const userJWT = request.cookies[MULTI_AUTH_JWT(userId)]
  if (!userJWT) {
    // no JWT for account switching found
    return request
  }

  if (userJWT) {
    // use JWT found in cookie pointed to by cookie pointer
    request.cookies[SESSION_COOKIE] = userJWT
    return request
  }

  return request
}

async function checkMultiAuthCookies (req, res) {
  if (!req.cookies[MULTI_AUTH_LIST] || !req.cookies[MULTI_AUTH_POINTER] || !req.cookies[SESSION_COOKIE]) {
    return false
  }

  const pointer = req.cookies[MULTI_AUTH_POINTER]
  if (isNaN(Number(pointer)) && pointer !== MULTI_AUTH_ANON) {
    return false
  }

  const accounts = b64Decode(req.cookies[MULTI_AUTH_LIST])
  for (const account of accounts) {
    const jwt = req.cookies[MULTI_AUTH_JWT(account.id)]
    if (!jwt) return false

    try {
      await decodeJWT({ token: jwt, secret: process.env.NEXTAUTH_SECRET })
    } catch (err) {
      return false
    }
  }

  return true
}

async function resetMultiAuthCookies (req, res) {
  const httpOnlyOptions = cookieOptions({ expires: 0, maxAge: 0 })
  const jsOptions = { ...httpOnlyOptions, httpOnly: false }

  // remove all multi_auth cookies ...
  for (const key of Object.keys(req.cookies)) {
    if (!MULTI_AUTH_REGEXP.test(key)) continue
    const options = MULTI_AUTH_JWT_REGEXP.test(key) ? httpOnlyOptions : jsOptions
    res.appendHeader('Set-Cookie', cookie.serialize(key, '', options))
  }

  // ... and reset to initial state if they are logged in
  const token = req.cookies[SESSION_COOKIE]
  if (!token) return

  const decoded = await decodeJWT({ token, secret: process.env.NEXTAUTH_SECRET })
  setMultiAuthCookies(req, res, { ...decoded, jwt: token })
}

class JwtExpiredError extends Error {
  constructor () {
    super('token expired')
    this.name = 'JwtExpiredError'
  }
}

async function refreshMultiAuthCookies (req, res) {
  const httpOnlyOptions = cookieOptions()
  const jsOptions = { ...httpOnlyOptions, httpOnly: false }

  const refreshCookie = (name) => {
    res.appendHeader('Set-Cookie', cookie.serialize(name, req.cookies[name], jsOptions))
  }

  const refreshToken = async (token) => {
    const secret = process.env.NEXTAUTH_SECRET
    const decoded = await decodeJWT({ token, secret })
    if (decoded.exp <= Date.now() / 1000) {
      throw new JwtExpiredError()
    }
    return await encodeJWT({
      token: decoded,
      secret
    })
  }

  const isAnon = req.cookies[MULTI_AUTH_POINTER] === MULTI_AUTH_ANON

  for (const [key, value] of Object.entries(req.cookies)) {
    // only refresh session cookie manually if we switched to anon since else it's already handled by next-auth
    if (key === SESSION_COOKIE && !isAnon) continue

    if (!MULTI_AUTH_REGEXP.test(key) && key !== SESSION_COOKIE) continue

    if (MULTI_AUTH_JWT_REGEXP.test(key) || key === SESSION_COOKIE) {
      const oldToken = value
      let newToken
      try {
        newToken = await refreshToken(oldToken)
      } catch (err) {
        if (err instanceof JwtExpiredError) {
          continue
        }
        throw err
      }
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

  const ok = await checkMultiAuthCookies(req, res)
  if (ok) {
    await refreshMultiAuthCookies(req, res)
  } else {
    await resetMultiAuthCookies(req, res)
  }
  return switchSessionCookie(req)
}
