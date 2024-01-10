import { NextResponse } from 'next/server'

const referrerMiddleware = (request) => {
  const regex = /(\/.*)?\/r\/([\w_]+)/
  const m = regex.exec(request.nextUrl.pathname)

  const url = new URL(m[1] || '/', request.url)
  url.search = request.nextUrl.search
  url.hash = request.nextUrl.hash

  const resp = NextResponse.redirect(url)
  resp.cookies.set('sn_referrer', m[2])
  return resp
}

const multiAuthMiddleware = (request) => {
  // switch next-auth session cookie with multi_auth cookie if cookie pointer present

  // is there a cookie pointer?
  const cookiePointerName = 'multi_auth.user-id'
  const hasCookiePointer = request.cookies?.has(cookiePointerName)
  // is there a session?
  const sessionCookieName = request.secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
  const hasSession = request.cookies?.has(sessionCookieName)

  if (!hasCookiePointer || !hasSession) {
    // no session or no cookie pointer. do nothing.
    return NextResponse.next({ request })
  }

  const userId = request.cookies?.get(cookiePointerName)?.value
  if (userId === 'anonymous') {
    // user switched to anon. only delete session cookie.
    request.cookies.delete(sessionCookieName)
    return NextResponse.next({ request })
  }

  const userJWT = request.cookies.get(`multi_auth.${userId}`)?.value
  if (!userJWT) {
    // no multi auth JWT found
    return NextResponse.next({ request })
  }

  if (userJWT) {
    // multi auth JWT found in cookie that pointed to by cookie pointer that is different to current session cookie.
    request.cookies.set(sessionCookieName, userJWT)
    return NextResponse.next({ request })
  }

  return NextResponse.next({ request })
}

export function middleware (request) {
  const referrerRegexp = /(\/.*)?\/r\/([\w_]+)/
  if (referrerRegexp.test(request.nextUrl.pathname)) {
    return referrerMiddleware(request)
  }
  return multiAuthMiddleware(request)
}

export const config = {
  matcher: [
    // referrals
    '/(.*/|)r/([\\w_]+)([?#]?.*)',
    // account switching
    '/api/graphql', '/_next/data/(.*)'
  ]
}
