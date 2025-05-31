import { NextResponse, URLPattern } from 'next/server'
import { getDomainMapping } from '@/lib/domains'
import { SESSION_COOKIE, cookieOptions } from '@/lib/auth'

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
// main domain
const SN_MAIN_DOMAIN = new URL(process.env.NEXT_PUBLIC_URL)
// territory paths that needs to be rewritten to ~subname
const SN_TERRITORY_PATHS = ['/~', '/recent', '/random', '/top', '/post', '/edit']

async function customDomainMiddleware (request, domain, subName) {
  // clone the url to build on top of it
  const url = request.nextUrl.clone()
  // we need pathname, searchParams and origin
  const { pathname, searchParams } = url
  // set the subname in the request headers
  const headers = new Headers(request.headers)
  headers.set('x-stacker-news-subname', subName)

  // TEST
  console.log('[domains] custom domain', domain, 'with subname', subName) // TEST
  console.log('[domains] main domain', SN_MAIN_DOMAIN) // TEST
  console.log('[domains] pathname', pathname) // TEST
  console.log('[domains] searchParams', searchParams) // TEST

  // Auth Sync
  // if the user is trying to login or signup, redirect to the Auth Sync API
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    const signup = pathname.startsWith('/signup')
    return redirectToAuthSync(searchParams, domain, signup)
  }
  // if we have a verification token, exchange it for a session token
  if (searchParams.has('token')) return establishAuthSync(request, searchParams)

  // Territory URLs
  // if sub param exists and doesn't match the domain's subname, update it
  if (searchParams.has('sub') && searchParams.get('sub') !== subName) {
    console.log('[domains] setting sub to', subName) // TEST
    searchParams.set('sub', subName)
    url.search = searchParams.toString()
    return NextResponse.redirect(url, { headers })
  }

  // clean up the pathname from any subname
  if (pathname.startsWith('/~')) {
    const cleanPath = pathname.replace(/^\/~[^/]+/, '') || '/'
    url.pathname = cleanPath
    console.log('[domains] redirecting to clean url:', url) // TEST
    // redirect to the clean path
    return NextResponse.redirect(url, { headers })
  }

  // if we're at the root or on some territory path, hide the subname by rewriting
  if (pathname === '/' || SN_TERRITORY_PATHS.some(p => pathname.startsWith(p))) {
    url.pathname = `/~${subName}${pathname === '/' ? '' : pathname}`
    console.log('[domains] rewrite to:', url.pathname) // TEST
    // rewrite to the territory path
    return NextResponse.rewrite(url, { headers })
  }

  // continue if we don't need to redirect, mainly for API routes
  return NextResponse.next({ request: { headers } })
}

// redirect to the Auth Sync API
async function redirectToAuthSync (searchParams, domain, signup) {
  const syncUrl = new URL('/api/auth/sync', SN_MAIN_DOMAIN)
  syncUrl.searchParams.set('domain', domain)

  // if we're signing up, we need to set the signup flag
  if (signup) {
    syncUrl.searchParams.set('signup', 'true')
  }

  // if we have a callbackUrl, we need to set it as redirectUri
  if (searchParams.has('callbackUrl')) {
    const callbackUrl = searchParams.get('callbackUrl')
    // extract just the path portion if it's a full URL
    const redirectUri = callbackUrl.startsWith('http')
      ? new URL(callbackUrl).pathname
      : callbackUrl
    syncUrl.searchParams.set('redirectUri', redirectUri)
  }

  return NextResponse.redirect(syncUrl)
}

// POST to /api/auth/sync and set the session cookie
async function establishAuthSync (request, searchParams) {
  // get the verification token from the search params
  const token = searchParams.get('token')
  // get the redirectUri from the search params
  const redirectUri = searchParams.get('redirectUri') || '/'
  // prepare redirect to the redirectUri
  const res = NextResponse.redirect(new URL(decodeURIComponent(redirectUri), request.url))

  // POST to /api/auth/sync to exchange verification token for session token
  const response = await fetch(`${SN_MAIN_DOMAIN.origin}/api/auth/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      verificationToken: token
    })
  })

  // get the session token from the response
  const data = await response.json()
  if (data.status === 'ERROR') {
    // if the response is an error, redirect to the home page
    return NextResponse.redirect(new URL('/', request.url))
  }

  // set the session cookie
  res.cookies.set(SESSION_COOKIE, data.sessionToken, cookieOptions())
  return res
}

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

function applyReferrerCookies (response, referrer) {
  for (const cookie of referrer.cookies.getAll()) {
    response.cookies.set(
      cookie.name,
      cookie.value,
      {
        maxAge: cookie.maxAge,
        expires: cookie.expires,
        path: cookie.path
      }
    )
  }
  console.log('[domains] response.cookies', response.cookies) // TEST
  return response
}

function applySecurityHeaders (resp) {
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

export async function middleware (request) {
  const referrerResp = referrerMiddleware(request)
  // TODO: check if we actually need this, and WHY
  if (referrerResp.headers.get('Location')) {
    // this is a redirect, apply security headers
    return applySecurityHeaders(referrerResp)
  }

  // if we're on a custom domain, handle it
  const domain = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (domain !== SN_MAIN_DOMAIN?.host) { // we don't need middleware to fail if dev messes up ENVs
    // in development we might have a port in the domain
    const domainToMap = process.env.NODE_ENV === 'development' ? domain.split(':')[0] : domain
    // check if we have a mapping for this domain
    const subName = await getDomainMapping(domainToMap)
    if (subName) {
      console.log('[domains] allowed custom domain', domain, 'detected, pointing to', subName) // TEST
      const resp = await customDomainMiddleware(request, domain, subName.subName)
      // apply referrer cookies to the custom domain response
      const referredResp = applyReferrerCookies(resp, referrerResp)
      // finally apply security headers
      return applySecurityHeaders(referredResp)
    }
  }

  return applySecurityHeaders(referrerResp)
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
