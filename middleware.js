import { NextResponse, URLPattern } from 'next/server'

const referrerPattern = new URLPattern({ pathname: ':pathname(*)/r/:referrer([\\w_]+)' })
const itemPattern = new URLPattern({ pathname: '/items/:id(\\d+){/:other(\\w+)}?' })
const profilePattern = new URLPattern({ pathname: '/:name([\\w_]+){/:type(\\w+)}?' })
const territoryPattern = new URLPattern({ pathname: '/~:name([\\w_]+){/*}?' })

// key for /r/... link referrers
const SN_REFERRER = 'sn_referrer'
// we use this to hold /r/... referrers through the redirect
const SN_REFERRER_NONCE = 'sn_referrer_nonce'
// key for referred pages
const SN_REFEREE_LANDING = 'sn_referee_landing'

function getContentReferrer (request, url) {
  if (itemPattern.test(url)) {
    let id = request.nextUrl.searchParams.get('commentId')
    if (!id) {
      ({ id } = itemPattern.exec(url).pathname.groups)
    }
    return `item-${id}`
  }
  if (profilePattern.test(url)) {
    const { name } = profilePattern.exec(url).pathname.groups
    return `profile-${name}`
  }
  if (territoryPattern.test(url)) {
    const { name } = territoryPattern.exec(url).pathname.groups
    return `territory-${name}`
  }
}

// we store the referrers in cookies for a future signup event
// we pass the referrers in the request headers so we can use them in referral rewards for logged in stackers
function referrerMiddleware (request) {
  if (referrerPattern.test(request.url)) {
    const { pathname, referrer } = referrerPattern.exec(request.url).pathname.groups

    const url = new URL(pathname || '/', request.url)
    url.search = request.nextUrl.search
    url.hash = request.nextUrl.hash

    const response = NextResponse.redirect(url)
    // explicit referrers are set for a day and can only be overriden by other explicit
    // referrers. Content referrers do not override explicit referrers because
    // explicit referees might click around before signing up.
    response.cookies.set(SN_REFERRER, referrer, { maxAge: 60 * 60 * 24 })

    // we record the first page the user lands on and keep it for 24 hours
    // in addition to the explicit referrer, this allows us to tell the referrer
    // which share link the user clicked on
    const contentReferrer = getContentReferrer(request, url)
    if (contentReferrer) {
      response.cookies.set(SN_REFEREE_LANDING, contentReferrer, { maxAge: 60 * 60 * 24 })
    }
    // store the explicit referrer for one page load
    // this allows us to attribute both explicit and implicit referrers after the redirect
    // e.g. items/<num>/r/<referrer> links should attribute both the item op and the referrer
    // without this the /r/<referrer> would be lost on redirect
    response.cookies.set(SN_REFERRER_NONCE, referrer, { maxAge: 1 })
    return response
  }

  const contentReferrer = getContentReferrer(request, request.url)

  // pass the referrers to SSR in the request headers for one day referrer attribution
  const requestHeaders = new Headers(request.headers)
  const referrers = [request.cookies.get(SN_REFERRER_NONCE)?.value, contentReferrer].filter(Boolean)
  if (referrers.length) {
    requestHeaders.set('x-stacker-news-referrer', referrers.join('; '))
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })

  // if we don't already have an explicit referrer, give them the content referrer as one
  if (!request.cookies.has(SN_REFERRER) && contentReferrer) {
    response.cookies.set(SN_REFERRER, contentReferrer, { maxAge: 60 * 60 * 24 })
  }

  return response
}

export function middleware (request) {
  const resp = referrerMiddleware(request)

  const isDev = process.env.NODE_ENV === 'development'

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  // we want to load media from other localhost ports during development
  const devSrc = isDev ? ' localhost:* http: ws:' : ''
  // unsafe-eval is required during development due to react-refresh.js
  // see https://github.com/vercel/next.js/issues/14221
  const devScriptSrc = isDev ? " 'unsafe-eval'" : ''

  const cspHeader = [
    // if something is not explicitly allowed, we don't allow it.
    "default-src 'self' a.stacker.news",
    "font-src 'self' a.stacker.news",
    // we want to load images from everywhere but we can limit to HTTPS at least
    "img-src 'self' a.stacker.news m.stacker.news https: data: blob:" + devSrc,
    "media-src 'self' a.stacker.news m.stacker.news https: blob:" + devSrc,
    // Using nonces and strict-dynamic deploys a strict CSP.
    // see https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html#strict-policy.
    // Old browsers will ignore nonce and strict-dynamic and fallback to host-based matching and unsafe-inline
    `script-src 'self' a.stacker.news 'unsafe-inline' 'wasm-unsafe-eval' 'nonce-${nonce}' 'strict-dynamic' https:` + devScriptSrc,
    // unsafe-inline for styles is not ideal but okay if script-src is using nonces
    "style-src 'self' a.stacker.news 'unsafe-inline'",
    "manifest-src 'self'",
    'frame-src www.youtube.com platform.twitter.com njump.me open.spotify.com rumble.com embed.wavlake.com bitcointv.com peertube.tv',
    "connect-src 'self' https: wss:" + devSrc,
    // disable dangerous plugins like Flash
    "object-src 'none'",
    // blocks injection of <base> tags
    "base-uri 'none'",
    // tell user agents to replace HTTP with HTTPS
    isDev ? '' : 'upgrade-insecure-requests',
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
      source: '/((?!api|_next/static|_error|404|500|offline|_next/image|_next/webpack-hmr|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
}
