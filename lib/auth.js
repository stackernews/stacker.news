import * as cookie from 'cookie'
import { NodeNextRequest } from 'next/dist/server/base-http/node'
import { encode as encodeJWT, decode as decodeJWT } from 'next-auth/jwt'
import { isSecureRequest } from '@/lib/safe-url'

const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
const b64Decode = s => JSON.parse(Buffer.from(s, 'base64'))

const isProd = process.env.NODE_ENV === 'production'

// Cookie names get the __Secure- prefix only in prod, where the prefix is
// guaranteed honor-able. Keeping names stable in dev lets the same imported
// constant work whether the request came in via HTTP localhost or HTTPS proxy.
export const secureCookie = (name) =>
  isProd
    ? `__Secure-${name}`
    : name

export const SESSION_COOKIE = secureCookie('next-auth.session-token')
export const MULTI_AUTH_LIST = secureCookie('multi_auth')
export const MULTI_AUTH_POINTER = secureCookie('multi_auth.user-id')
export const MULTI_AUTH_ANON = 'anonymous'

export const MULTI_AUTH_JWT = id => secureCookie(`multi_auth.${id}`)

const MULTI_AUTH_REGEXP = /^(__Secure-)?multi_auth/
const MULTI_AUTH_JWT_REGEXP = /^(__Secure-)?multi_auth\.\d+$/

// Pass `req` to make `secure` per-request. `secure` may also be overridden
// directly. `maxAge` defaults to 30 days; pass 0 to clear. `expires` is
// derived from `maxAge` (skipped on clear so `Max-Age=0` is unambiguous).
// All other args spread onto the result.
export const cookieOptions = ({ req, secure, maxAge = 2592000, ...rest } = {}) => ({
  path: '/',
  secure: secure ?? isSecureRequest(req),
  httpOnly: true,
  sameSite: 'lax',
  maxAge,
  expires: maxAge > 0 ? new Date(Date.now() + maxAge * 1000) : undefined,
  ...rest
})

// `req` is optional and only used to derive the per-request `Secure` flag.
// Pass it whenever you have one so dev custom-domain HTTPS gets `Secure`
// cookies and plain-HTTP localhost dev does not.
export function buildMultiAuthCookies (existingMultiAuth, { id, jwt, name, photoId }, req) {
  const httpOnlyOptions = cookieOptions({ req })
  const jsOptions = { ...httpOnlyOptions, httpOnly: false }

  const cookies = [
    // add JWT to **httpOnly** cookie
    { name: MULTI_AUTH_JWT(id), value: jwt, options: httpOnlyOptions },
    // switch to user we just added
    { name: MULTI_AUTH_POINTER, value: String(id), options: jsOptions }
  ]

  let newMultiAuth = [{ id, name, photoId }]
  if (existingMultiAuth) {
    const oldMultiAuth = b64Decode(existingMultiAuth)
    // make sure we don't add duplicates
    if (oldMultiAuth.some(({ id: id_ }) => id_ === id)) return cookies
    newMultiAuth = [...oldMultiAuth, ...newMultiAuth]
  }
  cookies.push({ name: MULTI_AUTH_LIST, value: b64Encode(newMultiAuth), options: jsOptions })
  return cookies
}

export function setMultiAuthCookies (req, res, entry) {
  const existingMultiAuth = req.cookies[MULTI_AUTH_LIST]
  const newCookies = buildMultiAuthCookies(existingMultiAuth, entry, req)

  for (const { name, value, options } of newCookies) {
    res.appendHeader('Set-Cookie', cookie.serialize(name, value, options))
  }
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
  const httpOnlyOptions = cookieOptions({ req, maxAge: 0 })
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
  const httpOnlyOptions = cookieOptions({ req })
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
