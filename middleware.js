import { NextResponse } from 'next/server'

const referrerRegex = /(\/.*)?\/r\/([\w_]+)/
function referrerMiddleware (request) {
  const m = referrerRegex.exec(request.nextUrl.pathname)

  const url = new URL(m[1] || '/', request.url)
  url.search = request.nextUrl.search
  url.hash = request.nextUrl.hash

  const resp = NextResponse.redirect(url)
  resp.cookies.set('sn_referrer', m[2])
  return resp
}

export function middleware (request) {
  let resp = NextResponse.next()
  if (referrerRegex.test(request.nextUrl.pathname)) {
    resp = referrerMiddleware(request)
  }

  const cspHeader = [
    "default-src 'none'",
    "font-src 'self'",
    "img-src 'self' https: data:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "manifest-src 'self'",
    "connect-src 'self' https: wss:",
    'upgrade-insecure-requests'
  ].join('; ')

  resp.headers.set('Content-Security-Policy', cspHeader)
  return resp
}

export const config = {
  matcher: [
    // NextJS recommends to not add the CSP header to prefetches and static assets
    // See https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
}
