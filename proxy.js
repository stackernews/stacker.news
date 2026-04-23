import 'urlpattern-polyfill'
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, cookieOptions } from '@/lib/auth'
import { getDomainMappingFromRequest, createDomainsDebugLogger, SN_MAIN_DOMAIN } from '@/lib/domains'

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
// territory paths that needs to be rewritten to ~subname
const SN_TERRITORY_PATHS = ['/new', '/top', '/post', '/edit', '/rss']

function isTerritoryPath (pathname) {
  return SN_TERRITORY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

async function customDomainMiddleware (request, domain, subName) {
  // logger is enabled if NEXT_PUBLIC_CUSTOM_DOMAINS_DEBUG == 1
  const logger = createDomainsDebugLogger(domain)
  // clone the url to build on top of it
  const url = request.nextUrl.clone()
  // we need pathname, searchParams and origin
  const { pathname, searchParams } = url
  // set the subname and domain in the request headers
  const headers = new Headers(request.headers)
  headers.set('x-stacker-news-subname', subName)
  headers.set('x-stacker-news-domain', domain)

  logger.log('custom domain', domain, 'with subname', subName)
  logger.log('pathname', pathname)
  logger.log('searchParams', JSON.stringify(searchParams))
  logger.log('search', url.search)

  // Auth Sync
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    const signup = pathname.startsWith('/signup')
    return redirectToAuthSync(searchParams, domain, signup, headers)
  }
  if (searchParams.has('sync_token')) return establishAuthSync(request, searchParams, domain, headers)

  // clean up the pathname from any subname
  if (pathname.startsWith('/~')) {
    const cleanPath = pathname.replace(/^\/~[^/]+/, '') || '/'
    url.pathname = cleanPath
    logger.log('redirecting to clean url:', url)
    // redirect to the clean path
    return NextResponse.redirect(url, { headers })
  }

  // if sub param exists and doesn't match the domain's subname, update it
  if (searchParams.has('sub') && searchParams.get('sub') !== subName) {
    logger.log('setting sub to', subName)
    searchParams.set('sub', subName)
    url.search = searchParams.toString()
    logger.log('new searchParams', url.search)
    logger.log('new url', url)
    return NextResponse.redirect(url, { headers })
  }

  // if we're at the root or on some territory path, hide the subname by rewriting
  if (pathname === '/' || isTerritoryPath(pathname)) {
    url.pathname = `/~${subName}${pathname === '/' ? '' : pathname}`
    logger.log('rewrite to:', url.pathname)
    // rewrite to the territory path
    return NextResponse.rewrite(url, { headers })
  }

  // continue if we don't need to redirect, mainly for API routes
  return NextResponse.next({ request: { headers } })
}

async function redirectToAuthSync (searchParams, domain, signup, headers) {
  const syncUrl = new URL('/api/auth/sync', SN_MAIN_DOMAIN)
  syncUrl.searchParams.set('domain', domain)

  if (signup) {
    syncUrl.searchParams.set('signup', 'true')
  }

  if (searchParams.has('callbackUrl')) {
    const callbackUrl = searchParams.get('callbackUrl')
    const redirectUri = callbackUrl.startsWith('http')
      ? new URL(callbackUrl).pathname
      : callbackUrl
    syncUrl.searchParams.set('redirectUri', redirectUri)
  }

  return NextResponse.redirect(syncUrl, { headers })
}

async function establishAuthSync (request, searchParams, domain, headers) {
  const token = searchParams.get('sync_token')
  const redirectUri = searchParams.get('redirectUri') || '/'
  const res = NextResponse.redirect(new URL(redirectUri, request.url), { headers })

  try {
    const domainName = process.env.NODE_ENV === 'development' ? domain.split(':')[0] : domain
    const body = JSON.stringify({ verificationToken: token, domainName })
    const fetchHeaders = new Headers(headers)
    fetchHeaders.set('Content-Type', 'application/json')

    const response = await fetch(`${SN_MAIN_DOMAIN.origin}/api/auth/sync`, {
      method: 'POST',
      headers: fetchHeaders,
      body,
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(response.status)
    }

    const data = await response.json()
    if (data.status === 'ERROR') {
      throw new Error(data.reason)
    }

    res.cookies.set(SESSION_COOKIE, data.sessionToken, cookieOptions())
    return res
  } catch (error) {
    console.error('[auth sync] cannot establish auth sync:', error.message)
    return NextResponse.redirect(new URL('/error', request.url), { headers })
  }
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
    'frame-src www.youtube.com www.youtube-nocookie.com platform.twitter.com njump.me open.spotify.com rumble.com embed.wavlake.com bitcointv.com peertube.tv',
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
  resp.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  return resp
}

export async function proxy (req) {
  // clear subname header to prevent potential spoofing
  const headers = new Headers(req.headers)
  headers.delete('x-stacker-news-subname')
  headers.delete('x-stacker-news-domain')
  const request = new NextRequest(req, { headers })

  let resp = referrerMiddleware(request)
  // if resp is a redirect, apply security headers immediately and return
  if (resp.headers.get('Location')) {
    return applySecurityHeaders(resp)
  }

  // if we're on a custom domain, handle it
  const mapping = await getDomainMappingFromRequest(request)
  if (mapping) {
    const domainResp = await customDomainMiddleware(request, mapping.domainName, mapping.subName)
    // apply referrer cookies to the custom domain response
    resp = applyReferrerCookies(domainResp, resp)
  }

  return applySecurityHeaders(resp)
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
