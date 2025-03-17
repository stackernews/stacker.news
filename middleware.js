import { NextResponse, URLPattern } from 'next/server'
import { cachedFetcher } from '@/lib/fetch'
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

const TERRITORY_PATHS = ['/~', '/recent', '/random', '/top', '/post', '/edit']
const NO_REWRITE_PATHS = ['/api', '/_next', '/_error', '/404', '/500', '/offline', '/static']

// fetch custom domain mappings from our API, caching it for 5 minutes
const getDomainMappingsCache = cachedFetcher(async function fetchDomainMappings () {
  const url = `${process.env.NEXT_PUBLIC_URL}/api/domains`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Cannot fetch domain mappings: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    return Object.keys(data).length > 0 ? data : null
  } catch (error) {
    console.error('Cannot fetch domain mappings:', error)
    return null
  }
}, {
  cacheExpiry: 300000, // 5 minutes cache
  forceRefreshThreshold: 600000, // 10 minutes before force refresh
  keyGenerator: () => 'domain_mappings'
})

export async function customDomainMiddleware (request, referrerResp) {
  const host = request.headers.get('host')
  const referer = request.headers.get('referer')
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  const mainDomain = process.env.NEXT_PUBLIC_URL + '/'
  console.log('host', host)
  console.log('mainDomain', mainDomain)

  console.log('referer', referer)

  const domainMapping = await getDomainMappingsCache()
  console.log('domainMapping', domainMapping)
  const domainInfo = domainMapping?.[host.toLowerCase()]
  if (!domainInfo) {
    console.log('Redirecting to main domain')
    return NextResponse.redirect(new URL(pathname, mainDomain))
  }

  if (NO_REWRITE_PATHS.some(p => pathname.startsWith(p)) || pathname.includes('.')) {
    return NextResponse.next()
  }

  console.log('pathname', pathname)
  console.log('query', url.searchParams)

  // if the url contains the territory path, remove it
  if (pathname.startsWith(`/~${domainInfo.subName}`)) {
    // remove the territory prefix from the path
    const cleanPath = pathname.replace(`/~${domainInfo.subName}`, '') || '/'
    console.log('Redirecting to clean path:', cleanPath)
    const redirectResp = NextResponse.redirect(new URL(cleanPath + url.search, url.origin))
    return applyReferrerCookies(redirectResp, referrerResp)
  }

  // if coming from main domain, handle auth automatically
  if (referer && referer === mainDomain) {
    const authResp = customDomainAuthMiddleware(request, url)
    if (authResp && authResp.status !== 200) {
      return applyReferrerCookies(authResp, referrerResp)
    }
  }

  const internalUrl = new URL(url)
  // rewrite to the territory path if we're at the root
  if (pathname === '/' || TERRITORY_PATHS.some(p => pathname.startsWith(p))) {
    internalUrl.pathname = `/~${domainInfo.subName}${pathname === '/' ? '' : pathname}`
  }
  console.log('Rewrite to:', internalUrl.pathname)
  // rewrite to the territory path
  const resp = NextResponse.rewrite(internalUrl)
  // copy referrer cookies to the rewritten response
  return applyReferrerCookies(resp, referrerResp)
}

// TODO: dirty of previous iterations, refactor
// UNSAFE UNSAFE UNSAFE tokens are visible in the URL
// Redirect to Auth Sync if user is not logged in or has no multi_auth sessions
export function customDomainAuthMiddleware (request, url) {
  const host = request.headers.get('host')
  const mainDomain = process.env.NEXT_PUBLIC_URL
  const pathname = url.pathname

  // check for session both in session token and in multi_auth cookie
  const secure = process.env.NODE_ENV === 'development' // TODO: change this to production
  const sessionCookieName = secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
  const multiAuthUserId = request.cookies.get('multi_auth.user-id')?.value

  // 1. We have a session token directly, or
  // 2. We have a multi_auth user ID and the corresponding multi_auth cookie
  const hasActiveSession = !!request.cookies.get(sessionCookieName)?.value
  const hasMultiAuthSession = multiAuthUserId && !!request.cookies.get(`multi_auth.${multiAuthUserId}`)?.value

  const hasSession = hasActiveSession || hasMultiAuthSession
  const response = NextResponse.next()

  if (!hasSession) {
    // TODO: original request url points to localhost, this is a workaround atm
    const protocol = secure ? 'https' : 'http'
    const originalDomain = `${protocol}://${host}`
    const redirectTarget = `${originalDomain}${pathname}`

    // Create the auth sync URL with the correct original domain
    const syncUrl = new URL(`${mainDomain}/api/auth/sync`)
    syncUrl.searchParams.set('redirectUrl', redirectTarget)

    console.log('AUTH: Redirecting to:', syncUrl.toString())
    console.log('AUTH: With redirect back to:', redirectTarget)
    const redirectResponse = NextResponse.redirect(syncUrl)
    return redirectResponse
  }

  console.log('No redirect')
  return response
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
  console.log('response.cookies', response.cookies)
  return response
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

export function applySecurityHeaders (resp) {
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
  // First run referrer middleware to capture referrer data
  const referrerResp = referrerMiddleware(request)

  // If we're on a custom domain, handle that next
  const host = request.headers.get('host')
  const isCustomDomain = host !== process.env.NEXT_PUBLIC_URL.replace(/^https?:\/\//, '')
  if (isCustomDomain) {
    const customDomainResp = await customDomainMiddleware(request, referrerResp)
    return applySecurityHeaders(customDomainResp)
  }

  console.log('applying security headers')

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
