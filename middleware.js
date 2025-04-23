import { NextResponse, URLPattern } from 'next/server'
import { domainLogger, getDomainMappingsCache } from '@/lib/domains'

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
// rewrite to ~subName paths
const TERRITORY_PATHS = ['/~', '/recent', '/random', '/top', '/post', '/edit']

// Redirects and rewrites for custom domains
async function customDomainMiddleware (req, referrerResp, mainDomain, domain, subName) {
  // clone the request url to build on top of it
  const url = req.nextUrl.clone()
  // get the pathname from the url
  const pathname = url.pathname
  // get the query params from the url
  const query = url.searchParams

  // TEST
  domainLogger().log('req.headers host', req.headers.get('host'))
  domainLogger().log('main domain', mainDomain)
  domainLogger().log('custom domain', domain)
  domainLogger().log('subName', subName)
  domainLogger().log('pathname', pathname)
  domainLogger().log('query', query)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-stacker-news-subname', subName)

  // Auth sync redirects with domain and optional callbackUrl and multiAuth params
  if (pathname === '/login' || pathname === '/signup') {
    const redirectUrl = new URL(pathname, mainDomain)
    redirectUrl.searchParams.set('domain', domain)
    if (query.get('callbackUrl')) {
      redirectUrl.searchParams.set('callbackUrl', query.get('callbackUrl'))
    }
    if (query.get('multiAuth')) {
      redirectUrl.searchParams.set('multiAuth', query.get('multiAuth'))
    }
    const redirectResp = NextResponse.redirect(redirectUrl, {
      headers: requestHeaders
    })
    // apply referrer cookies to the redirect
    return applyReferrerCookies(redirectResp, referrerResp)
  }

  // If trying to access a ~subname path, rewrite to /
  if (pathname.startsWith(`/~${subName}`)) {
    // remove the territory prefix from the path
    const cleanPath = pathname.replace(`/~${subName}`, '') || '/'
    domainLogger().log('Redirecting to clean path:', cleanPath)
    const redirectResp = NextResponse.redirect(new URL(cleanPath + url.search, url.origin), {
      headers: requestHeaders
    })
    // apply referrer cookies to the redirect
    return applyReferrerCookies(redirectResp, referrerResp)
  }

  // If we're at the root or a territory path, rewrite to the territory path
  if (pathname === '/' || TERRITORY_PATHS.some(p => pathname.startsWith(p))) {
    const internalUrl = new URL(url)
    internalUrl.pathname = `/~${subName}${pathname === '/' ? '' : pathname}`
    domainLogger().log('Rewrite to:', internalUrl.pathname)
    // rewrite to the territory path
    const resp = NextResponse.rewrite(internalUrl, {
      headers: requestHeaders
    })
    // apply referrer cookies to the rewrite
    return applyReferrerCookies(resp, referrerResp)
  }

  // continue if we don't need to rewrite or redirect
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })
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
  domainLogger().log('response.cookies', response.cookies)
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
  // First run referrer middleware to capture referrer data
  const referrerResp = referrerMiddleware(request)
  if (referrerResp.headers.get('Location')) {
    // This is a redirect from the referrer middleware
    return applySecurityHeaders(referrerResp)
  }

  // If we're on a custom domain, handle that next
  const domain = request.headers.get('x-forwarded-host') || request.headers.get('host')
  // get the main domain from the env vars
  const mainDomain = new URL(process.env.NEXT_PUBLIC_URL).host
  if (domain !== mainDomain) {
    // get the subName from the domain mappings cache
    const { subName } = await getDomainMappingsCache()?.[domain?.toLowerCase()]
    if (subName) {
      domainLogger().log('detected allowed custom domain for: ', subName)
      // handle the custom domain
      const customDomainResp = await customDomainMiddleware(request, referrerResp, mainDomain, domain, subName)
      return applySecurityHeaders(customDomainResp)
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
