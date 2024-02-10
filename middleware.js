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

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const cspHeader = [
    // if something is not explicitly allowed, we don't allow it.
    "default-src 'none'",
    "font-src 'self'",
    // we want to load images from everywhere but we can limit to HTTPS at least
    "img-src 'self' https: data:",
    // Using nonces and strict-dynamic deploys a strict CSP.
    // see https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html#strict-policy.
    // Old browsers will ignore nonce and strict-dynamic
    // and fallback to host matching, unsafe-inline and unsafe-eval (no protection against XSS)
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic' https:`,
    // unsafe-inline for styles is not ideal but okay if script-src is using nonces
    "style-src 'self' 'unsafe-inline'",
    "manifest-src 'self'",
    "connect-src 'self' https: wss:",
    // disable dangerous plugins like Flash
    "object-src 'none'",
    // blocks injection of <base> tags
    "base-uri 'none'",
    // tell user agents to replace HTTP with HTTPS
    'upgrade-insecure-requests',
    // prevents any domain from framing the content (defense against clickjacking attacks)
    "frame-ancestors 'none'"
  ].join('; ')

  resp.headers.set('Content-Security-Policy', cspHeader)
  // for browsers that don't support CSP
  resp.headers.set('X-Frame-Options', 'DENY')
  // more useful headers
  resp.headers.set('X-Content-Type-Options', 'nosniff')
  resp.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  resp.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

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
